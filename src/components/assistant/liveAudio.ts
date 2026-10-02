// Raw audio plumbing for the Gemini Live voice call: continuous microphone capture encoded as the 16-bit PCM/16kHz
// mono the Live API requires, and a gapless player for the 16-bit PCM/24kHz mono it sends back. Neither direction
// is a format the browser can hand to a <audio> tag or MediaRecorder -- both have to be built from raw samples by
// hand, which is what this file is for. Kept separate from the WebSocket client (liveVoiceClient.ts) so the audio
// plumbing and the protocol plumbing can each be read (and gotten wrong, and fixed) on their own.

// Posts a batch of Float32 samples, at whatever sample rate the AudioContext actually opened at (never assume
// 48000 -- it varies by device/OS), from the realtime audio thread to the main thread roughly every 2048 frames.
// Deliberately tiny and dependency-free: an AudioWorkletProcessor runs in its own global scope with no bundler or
// module imports available, so this has to be registered from a plain string, not a normal .ts file.
const CAPTURE_WORKLET_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(2048);
    this._len = 0;
  }
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel && channel.length) {
      for (let i = 0; i < channel.length; i++) {
        this._buf[this._len++] = channel[i];
        if (this._len >= this._buf.length) {
          this.port.postMessage(this._buf.slice(0, this._len));
          this._len = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

// Linear-interpolation resample from whatever rate the mic opened at down to the Live API's required 16kHz input
// rate. Good enough for speech recognition purposes (Gemini does its own, much better, processing downstream) --
// this just needs to not alias badly, not to be audiophile-grade.
function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return input;
  const ratio = fromRate / 16000;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcPos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
}

export interface MicCapture {
  stop(): void;
}

// Opens the microphone once and keeps it open for the whole call -- this is what "the mic never turns off between
// turns" actually means at the hardware level now, not just a UI state that happens to look that way. `onChunk`
// fires continuously with ~128ms of 16-bit PCM/16kHz audio (base64-encoded, ready for sendRealtimeInput) and the
// chunk's RMS loudness (0..~1) for the orb to react to while listening.
export async function startMicCapture(onChunk: (base64Pcm: string, level: number) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioContextCtor();
  const blobUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, 'capture-processor');
  worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const resampled = resampleTo16k(e.data, ctx.sampleRate);
    const level = rms(resampled);
    const pcm16 = floatTo16BitPCM(resampled);
    onChunk(int16ToBase64(pcm16), level);
  };
  source.connect(worklet);
  // Not connected to ctx.destination -- this graph only exists to tap the mic for encoding, never to play it back
  // (that would be feeding the visitor's own voice out of their speakers).

  return {
    stop() {
      try {
        worklet.port.onmessage = null;
        source.disconnect();
        worklet.disconnect();
      } catch {
        /* already torn down */
      }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

export interface PcmPlayer {
  enqueue(base64Pcm: string): void;
  /** Stops everything immediately and drops anything queued -- the interruption primitive. */
  clear(): void;
  isPlaying(): boolean;
  close(): void;
}

// Schedules incoming 16-bit PCM/24kHz chunks back-to-back on one AudioContext timeline so playback is gapless even
// though chunks arrive one at a time over the WebSocket -- each new chunk is scheduled to start exactly when the
// previous one ends, not "as soon as it arrives" (which would overlap/garble speech). `onLevel` mirrors each
// chunk's loudness to the caller (for the orb) at roughly the moment it's scheduled, since this is speech that's
// about to be heard, not speech that already happened.
export function createPcmPlayer(onLevel: (level: number) => void, onDrained: () => void): PcmPlayer {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioContextCtor();
  let nextStart = 0;
  let pending = 0;
  const active = new Set<AudioBufferSourceNode>();

  return {
    enqueue(base64Pcm: string) {
      const pcm16 = base64ToInt16(base64Pcm);
      if (pcm16.length === 0) return;
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
      onLevel(rms(float32));

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime, nextStart);
      node.start(startAt);
      nextStart = startAt + buffer.duration;
      pending += 1;
      active.add(node);
      node.onended = () => {
        active.delete(node);
        pending = Math.max(0, pending - 1);
        if (pending === 0) onDrained();
      };
    },
    clear() {
      for (const node of active) {
        try {
          node.onended = null;
          node.stop(0);
        } catch {
          /* already stopped */
        }
      }
      active.clear();
      pending = 0;
      nextStart = ctx.currentTime;
    },
    isPlaying() {
      return pending > 0;
    },
    close() {
      this.clear();
      ctx.close().catch(() => {});
    },
  };
}
