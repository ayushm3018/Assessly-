import { useCallback, useEffect, useRef, useState } from "react";

// Camera proctoring hook.
//
// All inference runs in-browser via MediaPipe Tasks Vision — the webcam stream
// and frames NEVER leave the device. We only report a short reason string to the
// existing server-authoritative /violation pipeline.
//
// ML is noisy, so a condition only becomes a violation after it has held
// continuously for a threshold, and each reason has a post-fire cooldown so a
// persistent phone/second-person can't drain all strikes at once.

// Models + WASM are loaded from CDN for dev convenience. For production, download
// these and self-host them under client/public to avoid the external dependency.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const OBJECT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

const DETECT_INTERVAL_MS = 250; // ~4 fps inference
const COOLDOWN_MS = 8000; // min gap between repeats of the same reason

// How long a condition must hold continuously before it counts as a strike.
const THRESHOLDS = {
  "phone-detected": 1500,
  "multiple-faces": 2000,
  "no-face": 4000,
  "looking-away": 3500,
};

// Head-turn limits (degrees) beyond which we treat the candidate as looking away.
const YAW_LIMIT = 22;
const PITCH_LIMIT = 18;

// Euler yaw/pitch (degrees) from a column-major 4x4 facial transformation matrix.
const headAnglesFromMatrix = (m) => {
  // upper-left 3x3 rotation (column-major indexing)
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  const pitch = Math.atan2(r21, r22) * (180 / Math.PI);
  const yaw = Math.atan2(-r20, Math.hypot(r21, r22)) * (180 / Math.PI);
  const roll = Math.atan2(r10, r00) * (180 / Math.PI);
  return { yaw, pitch, roll };
};

export default function useCameraProctoring({ enabled, onViolation }) {
  const [status, setStatus] = useState("idle"); // idle|loading|ready|denied|unsupported|error

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const objectDetectorRef = useRef(null);
  const rafRef = useRef(null);
  const lastDetectRef = useRef(0);
  const tickRef = useRef(0);

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Per-reason sustained timer + cooldown gate.
  const sinceRef = useRef({});
  const cooldownUntilRef = useRef({});

  const phonePresentRef = useRef(false); // last object-detector result (runs every other tick)
  const personCountRef = useRef(0);

  // Evaluate one reason: fire onViolation once it has held past its threshold and
  // is out of cooldown.
  const evaluate = useCallback((reason, active, now) => {
    if (!active) {
      sinceRef.current[reason] = null;
      return;
    }
    if (!sinceRef.current[reason]) sinceRef.current[reason] = now;
    const held = now - sinceRef.current[reason];
    const cooledDown = now >= (cooldownUntilRef.current[reason] || 0);
    if (held >= THRESHOLDS[reason] && cooledDown) {
      cooldownUntilRef.current[reason] = now + COOLDOWN_MS;
      onViolationRef.current?.(reason);
    }
  }, []);

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);

    const video = videoRef.current;
    const faceLm = faceLandmarkerRef.current;
    if (!enabledRef.current || !video || !faceLm) return;

    // Self-heal: the <video> can remount (e.g. the start-gate → interview
    // transition) and lose its srcObject while the stream stays live. Rebind.
    if (streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
    if (video.readyState < 2 || !video.videoWidth) return;

    const now = performance.now();
    if (now - lastDetectRef.current < DETECT_INTERVAL_MS) return;
    lastDetectRef.current = now;
    tickRef.current += 1;

    try {
      const faceRes = faceLm.detectForVideo(video, now);
      const faceCount = faceRes?.faceLandmarks?.length || 0;

      // Object detection is heavier — run it every other tick.
      const objDet = objectDetectorRef.current;
      if (objDet && tickRef.current % 2 === 0) {
        const objRes = objDet.detectForVideo(video, now);
        const dets = objRes?.detections || [];
        phonePresentRef.current = dets.some(
          (d) => d.categories?.[0]?.categoryName === "cell phone" && d.categories[0].score >= 0.5
        );
        personCountRef.current = dets.filter(
          (d) => d.categories?.[0]?.categoryName === "person" && d.categories[0].score >= 0.5
        ).length;
      }

      // Looking away — only meaningful with exactly one face present.
      let lookingAway = false;
      if (faceCount === 1 && faceRes.facialTransformationMatrixes?.[0]?.data) {
        const { yaw, pitch } = headAnglesFromMatrix(faceRes.facialTransformationMatrixes[0].data);
        lookingAway = Math.abs(yaw) > YAW_LIMIT || Math.abs(pitch) > PITCH_LIMIT;
      }

      evaluate("no-face", faceCount === 0, now);
      evaluate("multiple-faces", faceCount >= 2 || personCountRef.current >= 2, now);
      evaluate("phone-detected", phonePresentRef.current, now);
      evaluate("looking-away", lookingAway, now);
    } catch {
      /* transient detect error — skip this frame */
    }
  }, [evaluate]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return false;
    }
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setStatus("denied");
      return false;
    }

    try {
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, FaceLandmarker, ObjectDetector } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFacialTransformationMatrixes: true,
      });

      objectDetectorRef.current = await ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: OBJECT_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        scoreThreshold: 0.5,
        maxResults: 5,
      });

      setStatus("ready");
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [loop]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { faceLandmarkerRef.current?.close(); } catch {}
    try { objectDetectorRef.current?.close(); } catch {}
    faceLandmarkerRef.current = null;
    objectDetectorRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Stop everything on unmount.
  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, status, startCamera, stopCamera };
}
