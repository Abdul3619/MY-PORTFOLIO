// Thin wrapper around the Gemini Live API's raw WebSocket protocol. Hand-rolled rather than pulled in from
// @google/genai's browser client deliberately: that SDK is built/tested primarily for Node, and the wire protocol
// itself (one JSON object per message, documented at ai.google.dev/api/live) is simple enough that a plain
// WebSocket is less risk than dragging a Node-oriented SDK into a Vite browser bundle. VoiceCallOverlay.tsx owns
// *when* to connect/reconnect; this file only owns *how* to speak the protocol once asked to.

export interface VoiceSessionInfo {
  token: string;
  models: string[];
  systemInstruction: string;
  tools: Array<{ name: string; description?: string; parameters?: unknown }>;
}

// Mints the short-lived token (see chatbot/route.ts's createVoiceLiveRouter) this call will authenticate with --
// never the real GEMINI_API_KEY, which stays server-side.
export async function fetchVoiceSession(): Promise<VoiceSessionInfo> {
  const res = await fetch('/api/voice/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.token) throw new Error(body?.error || 'Could not start a voice session.');
  return body as VoiceSessionInfo;
}

export async function runVoiceTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    const res = await fetch('/api/voice/tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, input }),
    });
    const body = await res.json().catch(() => null);
    return body?.result || "Couldn't complete that right now. Offer the contact form or WhatsApp instead.";
  } catch {
    return "Couldn't reach the server for that just now. Offer the contact form or WhatsApp instead.";
  }
}

interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LiveVoiceCallbacks {
  onOutputAudioChunk: (base64Pcm: string) => void;
  onInputTranscript: (deltaText: string) => void;
  onOutputTranscript: (deltaText: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onToolCall: (calls: FunctionCall[]) => void;
  onToolCallCancelled: (ids: string[]) => void;
  onGoAway: (timeLeftMs: number) => void;
  onSessionHandle: (handle: string) => void;
  onClose: (wasClean: boolean) => void;
  onError: (message: string) => void;
}

export interface LiveVoiceHandle {
  modelUsed: string;
  sendAudioChunk: (base64Pcm: string) => void;
  sendToolResponse: (id: string, name: string, response: unknown) => void;
  close: () => void;
}

// Two URL shapes appear across Google's own docs for an ephemeral-token connection -- "BidiGenerateContent" with
// the token as access_token, and "BidiGenerateContentConstrained" for tokens locked to one model at mint time.
// Our tokens are deliberately unlocked (see createVoiceLiveRouter's comment on why), so the plain form is tried
// first; the Constrained form is a one-line fallback in case Google's docs/behaviour shift, rather than a hard
// dependency on guessing right the first time.
function wsUrl(token: string, constrained: boolean): string {
  const method = constrained ? 'BidiGenerateContentConstrained' : 'BidiGenerateContent';
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.${method}?access_token=${encodeURIComponent(token)}`;
}

const SETUP_TIMEOUT_MS = 7000;

function openOnce(
  url: string,
  model: string,
  session: VoiceSessionInfo,
  resumeHandle: string | undefined,
  callbacks: LiveVoiceCallbacks,
): Promise<LiveVoiceHandle> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(new Error('setup timed out'));
    }, SETUP_TIMEOUT_MS);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: { responseModalities: ['AUDIO'] },
            systemInstruction: { parts: [{ text: session.systemInstruction }] },
            ...(session.tools.length ? { tools: [{ functionDeclarations: session.tools }] } : {}),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                prefixPaddingMs: 100,
                silenceDurationMs: 700,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
              },
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
            },
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          },
        }),
      );
    };

    socket.onmessage = (event: MessageEvent) => {
      (async () => {
        // Live API messages are usually plain JSON text, but some browsers/proxies can hand a Blob even for a
        // text frame -- handle both rather than assuming.
        const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
        let msg: any;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        if (msg.setupComplete && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve({
            modelUsed: model,
            sendAudioChunk: (base64Pcm: string) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ realtimeInput: { audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' } } }));
              }
            },
            sendToolResponse: (id: string, name: string, response: unknown) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ toolResponse: { functionResponses: [{ id, name, response: { result: response } }] } }));
              }
            },
            close: () => socket.close(1000, 'client closed'),
          });
          return;
        }

        if (msg.serverContent) {
          const sc = msg.serverContent;
          if (sc.interrupted) callbacks.onInterrupted();
          const parts = sc.modelTurn?.parts ?? [];
          for (const part of parts) {
            const inline = part?.inlineData;
            if (inline?.data && String(inline.mimeType || '').startsWith('audio/')) {
              callbacks.onOutputAudioChunk(inline.data);
            }
          }
          if (typeof sc.inputTranscription?.text === 'string') callbacks.onInputTranscript(sc.inputTranscription.text);
          if (typeof sc.outputTranscription?.text === 'string') callbacks.onOutputTranscript(sc.outputTranscription.text);
          if (sc.turnComplete) callbacks.onTurnComplete();
        } else if (msg.toolCall?.functionCalls) {
          callbacks.onToolCall(msg.toolCall.functionCalls);
        } else if (msg.toolCallCancellation?.ids) {
          callbacks.onToolCallCancelled(msg.toolCallCancellation.ids);
        } else if (msg.sessionResumptionUpdate?.newHandle) {
          callbacks.onSessionHandle(msg.sessionResumptionUpdate.newHandle);
        } else if (msg.goAway) {
          const raw = String(msg.goAway.timeLeft ?? '0s');
          const seconds = parseFloat(raw.replace(/s$/, '')) || 0;
          callbacks.onGoAway(seconds * 1000);
        }
      })();
    };

    socket.onerror = () => {
      if (settled) {
        callbacks.onError('Voice connection error.');
        return;
      }
    };

    socket.onclose = (event: CloseEvent) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new Error(`closed before setup (${event.code})`));
        return;
      }
      callbacks.onClose(event.wasClean);
    };
  });
}

// Tries each candidate model (see GEMINI_LIVE_MODELS server-side) in turn, and within each model, both URL
// shapes -- so a single stale model name or an ambiguous docs detail doesn't take the whole feature down. Throws
// only once every combination has failed.
export async function connectLiveVoice(
  session: VoiceSessionInfo,
  resumeHandle: string | undefined,
  callbacks: LiveVoiceCallbacks,
): Promise<LiveVoiceHandle> {
  let lastErr: unknown;
  for (const model of session.models) {
    for (const constrained of [false, true]) {
      try {
        return await openOnce(wsUrl(session.token, constrained), model, session, resumeHandle, callbacks);
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not open a voice connection.');
}
