import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import {
  loadLivePoseLandmarker,
  detectPoseFromImage,
  detectPoseFromVideoFrame,
  POSE_CONNECTIONS,
  type Landmark,
} from "@/lib/atelierfit/measure";

export interface CapturedPose {
  landmarks: Landmark[];
  width: number;
  height: number;
}

// Replaces the old "hand off to the phone's native camera app" step: opens the camera live, right inside the
// app, with the body-tracking skeleton drawn over the feed in real time as you move, and a capture button
// instead of a separate camera roundtrip. Falls back to a plain file picker (reusing the same static-image
// detection AtelierFit always had) if the browser or device can't give a live camera stream at all -- manual
// entry further up the flow remains the full alternative either way.
export function LiveCameraStage({
  label,
  hint,
  onCaptured,
  captured,
  onRetake,
}: {
  label: string;
  hint: string;
  onCaptured: (pose: CapturedPose) => void;
  captured: CapturedPose | null;
  onRetake: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPoseRef = useRef<Landmark[] | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "unavailable">("starting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (captured) return; // already captured for this stage -- don't reopen the camera
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        const [stream, landmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 1280 } },
            audio: false,
          }),
          loadLivePoseLandmarker(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("live");

        const canvas = canvasRef.current;
        const draw = () => {
          if (cancelled || !video || !canvas) return;
          if (video.videoWidth && canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const pose = detectPoseFromVideoFrame(landmarker, video, performance.now());
          latestPoseRef.current = pose;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (pose) {
              ctx.strokeStyle = "#F06BA6";
              ctx.lineWidth = Math.max(2, canvas.width * 0.006);
              ctx.lineCap = "round";
              for (const [a, b] of POSE_CONNECTIONS) {
                const pa = pose[a], pb = pose[b];
                if (!pa || !pb) continue;
                ctx.beginPath();
                ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
                ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
                ctx.stroke();
              }
              ctx.fillStyle = "#FFD4EB";
              for (const p of pose) {
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, Math.max(2.5, canvas.width * 0.007), 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      } catch (e: any) {
        if (!cancelled) {
          setStatus("unavailable");
          setError(e?.message || "Couldn't open the camera -- you can upload a photo instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [captured, stopStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const pose = latestPoseRef.current;
    if (!video || !pose) {
      setError("Couldn't see a full body in frame -- step back so your head and feet are both visible, then try again.");
      return;
    }
    stopStream();
    onCaptured({ landmarks: pose, width: video.videoWidth, height: video.videoHeight });
  }, [onCaptured, stopStream]);

  const handleFileFallback = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("That file couldn't be read as an image."));
          img.src = url;
        });
        const landmarks = await detectPoseFromImage(img);
        onCaptured({ landmarks, width: img.naturalWidth, height: img.naturalHeight });
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (e: any) {
        setError(e?.message || "Couldn't find a body in that photo -- try another one.");
      } finally {
        setBusy(false);
      }
    },
    [onCaptured],
  );

  if (captured) {
    return (
      <div className="rounded-xl glass-card-subtle p-4 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
        <span className="flex-1 text-sm">{label} captured</span>
        <button onClick={onRetake} className="text-xs text-white/60 hover:text-white flex items-center gap-1">
          <RotateCcw size={13} /> Retake
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <p className="text-xs text-white/50">{hint}</p>

      {status !== "unavailable" ? (
        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-black border border-white/10">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="animate-spin text-white/70" size={28} />
            </div>
          )}
          {status === "live" && (
            <button
              onClick={handleCapture}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D6397D] text-black font-semibold text-sm shadow-lg"
            >
              <Camera size={16} /> Capture
            </button>
          )}
        </div>
      ) : (
        <label className="block w-full p-4 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-[#D6397D]/50 transition-colors cursor-pointer text-center">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileFallback(file);
            }}
          />
          {busy ? (
            <span className="flex items-center justify-center gap-2 text-sm text-white/60">
              <Loader2 className="animate-spin" size={16} /> Reading photo...
            </span>
          ) : (
            <span className="text-sm text-white/60">Live camera isn't available here -- tap to upload {label.toLowerCase()} instead</span>
          )}
        </label>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
