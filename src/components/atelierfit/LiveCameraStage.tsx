import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
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
  const [tracked, setTracked] = useState(false);
  // "environment" = the back/world-facing camera, "user" = the front/selfie camera. Phones only -- front and
  // back are the two cameras worth switching between; desktops with one webcam never see this button change
  // anything, which is fine since there's nothing to switch to.
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [canFlip, setCanFlip] = useState(true);

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (captured) return; // already captured for this stage -- don't reopen the camera
    let cancelled = false;
    setTracked(false);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        const [stream, landmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
            audio: false,
          }),
          loadLivePoseLandmarker(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // If the device only has one camera, flipping would just reopen the same stream -- hide the button
        // rather than offer a toggle that visibly does nothing.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
        } catch {
          setCanFlip(true); // can't enumerate (permissions-gated on some browsers until after first grant) -- default to showing it
        }
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
          setTracked((prev) => (prev === !!pose ? prev : !!pose));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (pose) {
              // Bounding box of the tracked body, padded a little -- drawn as an AR-style scan frame (corner
              // brackets, not a full rectangle) so the live view reads as "actively measuring a volume", not
              // just a flat line-drawing traced over the video.
              let minX = 1, minY = 1, maxX = 0, maxY = 0;
              for (const p of pose) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
              }
              const pad = 0.04;
              const bx = Math.max(0, (minX - pad) * canvas.width);
              const by = Math.max(0, (minY - pad) * canvas.height);
              const bw = Math.min(canvas.width, (maxX - minX + pad * 2) * canvas.width) - bx;
              const bh = Math.min(canvas.height, (maxY - minY + pad * 2) * canvas.height) - by;
              const cornerLen = Math.max(14, canvas.width * 0.05);

              ctx.save();
              ctx.strokeStyle = "rgba(255, 212, 235, 0.9)";
              ctx.lineWidth = Math.max(2.5, canvas.width * 0.007);
              ctx.lineCap = "round";
              ctx.shadowColor = "#F06BA6";
              ctx.shadowBlur = 14;
              const corners: [number, number, number, number][] = [
                [bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1],
              ];
              for (const [cx, cy, dx, dy] of corners) {
                ctx.beginPath();
                ctx.moveTo(cx, cy + cornerLen * dy);
                ctx.lineTo(cx, cy);
                ctx.lineTo(cx + cornerLen * dx, cy);
                ctx.stroke();
              }
              ctx.restore();

              // The skeleton itself -- thicker, glowing strokes (vs. the original thin flat lines) so it
              // reads as an active 3D-ish scan rather than a faint debug overlay.
              ctx.save();
              ctx.shadowColor = "#F06BA6";
              ctx.shadowBlur = 10;
              ctx.strokeStyle = "#F8A0C8";
              ctx.lineWidth = Math.max(3, canvas.width * 0.009);
              ctx.lineCap = "round";
              for (const [a, b] of POSE_CONNECTIONS) {
                const pa = pose[a], pb = pose[b];
                if (!pa || !pb) continue;
                ctx.beginPath();
                ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
                ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
                ctx.stroke();
              }
              ctx.restore();

              ctx.save();
              ctx.shadowColor = "#FFD4EB";
              ctx.shadowBlur = 8;
              ctx.fillStyle = "#FFFFFF";
              for (const p of pose) {
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, Math.max(3, canvas.width * 0.008), 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();

              // A vertical height-axis guide from the topmost to bottommost tracked point -- a light "ruler"
              // tick along the side of the frame, reinforcing that this is a measurement in progress, not
              // just a pose sketch.
              ctx.save();
              ctx.strokeStyle = "rgba(255, 212, 235, 0.5)";
              ctx.setLineDash([4, 6]);
              ctx.lineWidth = 1.5;
              const axisX = Math.max(10, bx - 10);
              ctx.beginPath();
              ctx.moveTo(axisX, by);
              ctx.lineTo(axisX, by + bh);
              ctx.stroke();
              ctx.restore();
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
  }, [captured, stopStream, facing]);

  const flipCamera = useCallback(() => {
    setStatus("starting");
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  }, []);

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
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-medium tracking-wide">
                <span className={`w-1.5 h-1.5 rounded-full ${tracked ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className={tracked ? "text-emerald-300" : "text-amber-200"}>
                  {tracked ? "Tracking · aligned" : "Step back into frame"}
                </span>
              </div>

              {canFlip && (
                <button
                  onClick={flipCamera}
                  aria-label="Switch camera"
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                >
                  <RefreshCw size={16} />
                </button>
              )}

              <button
                onClick={handleCapture}
                disabled={!tracked}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D6397D] text-black font-semibold text-sm shadow-lg disabled:opacity-50 transition-opacity"
              >
                <Camera size={16} /> Capture
              </button>
            </>
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
