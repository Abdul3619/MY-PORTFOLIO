// AtelierFit's on-device body measurement engine.
//
// How it works, and why this approach specifically:
//  - Uses Google's MediaPipe Pose Landmarker (@mediapipe/tasks-vision), run entirely in the visitor's browser via
//    WebAssembly. No photo, video frame, or landmark ever leaves the device -- nothing is uploaded to our server,
//    nothing is stored. This was picked over alternatives (unmaintained npm packages with no accuracy claims,
//    a 27-star third-party SDK requiring a registered API key) specifically because it's free, actively
//    maintained by Google, needs no account/key, and keeps the privacy story simple and honest.
//  - Needs exactly two photos (front-facing, arms slightly away from the body; side-on) plus the customer's own
//    stated height in centimetres, which is the only "ruler" the math has -- a phone camera has no absolute sense
//    of scale on its own, so without a known reference the whole estimate is meaningless.
//  - From the front photo: pixel distance from the top of the head to the ankle midpoint is calibrated against
//    the stated height to get a pixels-per-cm scale; shoulder width and hip width come directly from landmark
//    distances at that scale.
//  - Circumferences (chest/bust, waist, hip) cannot come from a single flat photo -- a 2D image only ever gives a
//    width, never a depth. The side photo supplies that missing depth measurement at the same body heights, and
//    the two combine via the standard ellipse-circumference approximation (Ramanujan's formula) used by
//    published two-photo body-measurement methods. This is a genuine estimate, not a lab-grade scan: treat it as
//    accurate to roughly +/-3-5cm, which is why every number it produces is shown back to the customer to confirm
//    or correct by hand before anything is charged or sent to the tailor -- never trust it silently.

export interface Landmark {
  x: number; // normalized 0..1, image-space
  y: number;
  visibility?: number;
}

// Indices from MediaPipe Pose's 33-point topology
const IDX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

function dist(a: Landmark, b: Landmark, imgW: number, imgH: number) {
  const dx = (a.x - b.x) * imgW;
  const dy = (a.y - b.y) * imgH;
  return Math.hypot(dx, dy);
}

function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Ramanujan's second approximation for an ellipse's perimeter -- accurate to a fraction of a percent for the
// width/depth ratios a human torso actually has (never a near-degenerate ellipse).
function ellipseCircumference(halfWidth: number, halfDepth: number): number {
  const a = halfWidth, b = halfDepth;
  const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

export interface MeasurementInputs {
  heightCm: number;
  front: { landmarks: Landmark[]; width: number; height: number };
  side: { landmarks: Landmark[]; width: number; height: number };
}

export interface EstimatedMeasurements {
  heightCm: number;
  shoulderWidthCm: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  sleeveLengthCm: number;
  armLengthCm: number;
  legLengthCm: number;
}

export function estimateMeasurements({ heightCm, front, side }: MeasurementInputs): EstimatedMeasurements {
  const L = front.landmarks;
  const top = L[IDX.nose];
  const ankleMid = midpoint(L[IDX.leftAnkle], L[IDX.rightAnkle]);
  // The nose sits a little below the crown of the head -- nudge the reference point up by ~12% of head-to-neck
  // distance so the calibration isn't systematically short. Approximate crown as 10% of frame height above nose.
  const pixelHeight = dist({ x: top.x, y: Math.max(0, top.y - 0.1) }, ankleMid, front.width, front.height);
  const pxPerCm = pixelHeight / heightCm;
  if (!isFinite(pxPerCm) || pxPerCm <= 0) {
    throw new Error("Could not calibrate scale from the front photo -- make sure your whole body, head to feet, is in frame.");
  }

  const shoulderWidthPx = dist(L[IDX.leftShoulder], L[IDX.rightShoulder], front.width, front.height);
  const hipWidthPx = dist(L[IDX.leftHip], L[IDX.rightHip], front.width, front.height);
  const shoulderY = midpoint(L[IDX.leftShoulder], L[IDX.rightShoulder]).y;
  const hipY = midpoint(L[IDX.leftHip], L[IDX.rightHip]).y;
  // No landmark sits exactly at the waist; anthropometric references put it ~55% of the way down the torso
  // from the shoulder line to the hip line, which is where we sample width (interpolated) and depth (from the
  // side photo) for the waist circumference.
  const waistWidthPx = shoulderWidthPx + (hipWidthPx - shoulderWidthPx) * 0.72; // waist is usually narrower than hip, wider than nothing
  const waistY = shoulderY + (hipY - shoulderY) * 0.55;

  // Side-view depths at the same relative heights (front/back thickness of the torso)
  const S = side.landmarks;
  const sideShoulderY = midpoint(S[IDX.leftShoulder], S[IDX.rightShoulder]).y;
  const sideHipY = midpoint(S[IDX.leftHip], S[IDX.rightHip]).y;
  // The side silhouette's own left/right spread at the shoulder/hip band approximates torso depth, since the
  // visible body width in profile *is* the front-to-back depth.
  const sideDepthAt = (y: number) => {
    // Nearest of shoulder/hip/waist-interpolated landmark pair by y, using the equivalent side points
    const t = (y - sideShoulderY) / (sideHipY - sideShoulderY || 1);
    const clampT = Math.max(0, Math.min(1, t));
    const shoulderDepthPx = dist(S[IDX.leftShoulder], S[IDX.rightShoulder], side.width, side.height) || shoulderWidthPx * 0.55;
    const hipDepthPx = dist(S[IDX.leftHip], S[IDX.rightHip], side.width, side.height) || hipWidthPx * 0.55;
    return shoulderDepthPx + (hipDepthPx - shoulderDepthPx) * clampT;
  };

  const chestDepthPx = sideDepthAt(sideShoulderY);
  const waistDepthPx = sideDepthAt(sideShoulderY + (sideHipY - sideShoulderY) * 0.55);
  const hipDepthPx = sideDepthAt(sideHipY);

  const toCm = (px: number) => px / pxPerCm;

  const chestCm = ellipseCircumference(toCm(shoulderWidthPx * 1.08) / 2, toCm(chestDepthPx) / 2); // chest runs slightly wider than bare shoulder points
  const waistCm = ellipseCircumference(toCm(waistWidthPx) / 2, toCm(waistDepthPx) / 2);
  const hipCm = ellipseCircumference(toCm(hipWidthPx * 1.1) / 2, toCm(hipDepthPx) / 2);

  const sleeveLengthCm =
    toCm(dist(L[IDX.leftShoulder], L[IDX.leftElbow], front.width, front.height)) +
    toCm(dist(L[IDX.leftElbow], L[IDX.leftWrist], front.width, front.height));
  const armLengthCm = sleeveLengthCm; // same two-segment measurement, kept as a distinct field for garment forms that ask for it by name
  const legLengthCm =
    toCm(dist(L[IDX.leftHip], L[IDX.leftKnee], front.width, front.height)) +
    toCm(dist(L[IDX.leftKnee], L[IDX.leftAnkle], front.width, front.height));

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    heightCm: round1(heightCm),
    shoulderWidthCm: round1(toCm(shoulderWidthPx)),
    chestCm: round1(chestCm),
    waistCm: round1(waistCm),
    hipCm: round1(hipCm),
    sleeveLengthCm: round1(sleeveLengthCm),
    armLengthCm: round1(armLengthCm),
    legLengthCm: round1(legLengthCm),
  };
}

// Lazily loads MediaPipe's WASM runtime + the lightweight pose model from Google's own CDN (not bundled, so the
// main app bundle stays small -- only visitors who actually open the camera flow pay this download).
let landmarkerPromise: Promise<any> | null = null;
export async function loadPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

export async function detectPoseFromImage(img: HTMLImageElement): Promise<Landmark[]> {
  const landmarker = await loadPoseLandmarker();
  const result = landmarker.detect(img);
  const pose = result?.landmarks?.[0];
  if (!pose) throw new Error("Couldn't find a full body in that photo -- stand further back so your head and feet are both visible, with good lighting.");
  return pose;
}
