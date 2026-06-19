import { useCallback, useEffect, useRef, useState } from "react";

// Camera proctoring hook.
//
// All inference runs in-browser via MediaPipe Tasks Vision — the webcam stream
// and frames NEVER leave the device. We only report a short reason string to the
// existing server-authoritative /violation pipeline.
//
// Detects: phone in frame, another person, candidate absent, and looking away —
// where "looking away" combines HEAD pose (yaw/pitch) AND EYE GAZE (iris position),
// both measured relative to a per-session calibration baseline.
//
// ML is noisy, so a condition only becomes a violation after it has held
// continuously for a threshold, and each reason has a post-fire cooldown.

// Models + WASM are loaded from CDN for dev convenience. For production, download
// these into client/public and switch to local paths, e.g.:
//   const WASM_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`;
//   const FACE_MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/models/face_landmarker.task`;
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const OBJECT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

const DETECT_INTERVAL_MS = 280; // ~3.5 fps inference (lower main-thread load)
const OBJECT_DETECT_EVERY = 3; // run the heavy object detector every Nth face tick
const COOLDOWN_MS = 8000; // min gap between repeats of the same reason
// If detection throws this many times in a row, the runtime can't run MediaPipe
// (almost always WebGL / hardware acceleration unavailable). Stop the loop so we
// don't burn the CPU spamming errors — the interview continues without camera
// proctoring (behavioral tab/fullscreen proctoring is unaffected).
const MAX_DETECT_ERRORS = 12;

// ---- Tunables (open the interview with ?debug to see live metrics) ----
// How long a condition must hold continuously before it counts as a strike.
const THRESHOLDS = {
  "phone-detected": 1500,
  "multiple-faces": 2000,
  "no-face": 4000,
  "looking-away": 1200,
};
// Head turn beyond baseline (degrees) that counts as looking away.
const YAW_LIMIT = 16;
const PITCH_LIMIT = 14;
// Eye-gaze deviation from baseline (0..1 ratio inside the eye) that counts as away.
const GAZE_X_LIMIT = 0.16;
const GAZE_Y_LIMIT = 0.22;
const GAZE_SMOOTH = 0.4; // EMA factor for jittery gaze (higher = snappier/noisier)

// Exposed for the dev debug overlay so it can show "held vs target" without drift.
export const PROCTOR_TUNABLES = {
  THRESHOLDS, YAW_LIMIT, PITCH_LIMIT, GAZE_X_LIMIT, GAZE_Y_LIMIT, DETECT_INTERVAL_MS,
};

// MediaPipe FaceMesh landmark indices (478-point model includes iris).
const L = { iris: 468, cornerA: 33, cornerB: 133, top: 159, bottom: 145 };
const R = { iris: 473, cornerA: 362, cornerB: 263, top: 386, bottom: 374 };

// Euler yaw/pitch (degrees) from a column-major 4x4 facial transformation matrix.
const headAnglesFromMatrix = (m) => {
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  const pitch = Math.atan2(r21, r22) * (180 / Math.PI);
  const yaw = Math.atan2(-r20, Math.hypot(r21, r22)) * (180 / Math.PI);
  return { yaw, pitch };
};

// Normalized iris position within one eye box: ~0.5 / ~0.5 when looking straight.
const eyeGaze = (lm, e) => {
  const xMin = Math.min(lm[e.cornerA].x, lm[e.cornerB].x);
  const xMax = Math.max(lm[e.cornerA].x, lm[e.cornerB].x);
  const yMin = Math.min(lm[e.top].y, lm[e.bottom].y);
  const yMax = Math.max(lm[e.top].y, lm[e.bottom].y);
  const gx = xMax > xMin ? (lm[e.iris].x - xMin) / (xMax - xMin) : 0.5;
  const gy = yMax > yMin ? (lm[e.iris].y - yMin) / (yMax - yMin) : 0.5;
  return { gx, gy };
};

const avg = (arr, key) => arr.reduce((s, o) => s + o[key], 0) / arr.length;

export default function useCameraProctoring({ enabled, onViolation }) {
  const [status, setStatus] = useState("idle"); // idle|loading|ready|denied|unsupported|error

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const objectDetectorRef = useRef(null);
  const timerRef = useRef(null);
  const lastDetectRef = useRef(0);
  const tickRef = useRef(0);

  // Diagnostics surfaced via metricsRef (debug overlay):
  const delegateRef = useRef(null); // "GPU" | "CPU" | null — which inference backend won
  const detectErrorsRef = useRef(0); // consecutive detect() failures (0 = healthy)
  const fpsRef = useRef(0); // measured detection frame rate
  const calibSamplesRef = useRef(0); // samples captured at last calibration (<3 = bad baseline)

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Per-reason sustained timer + cooldown gate.
  const sinceRef = useRef({});
  const cooldownUntilRef = useRef({});

  const phonePresentRef = useRef(false);
  const personCountRef = useRef(0);
  const smoothGazeRef = useRef({ x: 0.5, y: 0.5 });

  // Calibration baseline (neutral pose) + live metrics (for debug/calibration).
  const baselineRef = useRef({ yaw: 0, pitch: 0, gazeX: 0.5, gazeY: 0.5 });
  const calibratingRef = useRef(false);
  const metricsRef = useRef({ ready: false });

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
    // Self-pace at the detect cadence on a timer instead of a 60 fps rAF that
    // early-returns most frames — far less main-thread churn. Scheduling at the
    // top guarantees we keep ticking even on an early return below.
    timerRef.current = setTimeout(loop, DETECT_INTERVAL_MS);

    const video = videoRef.current;
    const faceLm = faceLandmarkerRef.current;

    // Always publish a diagnostic snapshot so the overlay can show WHY detection
    // isn't happening — the success block below only writes when a frame actually
    // gets processed, which hid early bails and thrown errors as "all dashes".
    const snap = (phase, extra) => {
      metricsRef.current = {
        ...metricsRef.current,
        delegate: delegateRef.current,
        detectErrors: detectErrorsRef.current,
        calibSamples: calibSamplesRef.current,
        fps: fpsRef.current,
        readyState: video?.readyState ?? -1,
        videoWidth: video?.videoWidth ?? 0,
        phase,
        ...extra,
      };
    };

    if (!video || !faceLm) {
      snap(!video ? "no-video-element" : "model-not-loaded");
      return;
    }

    // Self-heal: the <video> can remount (gate → calibration → interview) and lose
    // its srcObject while the stream stays live. Rebind to the current element.
    if (streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
    if (video.readyState < 2 || !video.videoWidth) {
      snap("video-not-ready");
      return;
    }

    const now = performance.now();
    if (lastDetectRef.current) {
      const dt = now - lastDetectRef.current;
      if (dt > 0) fpsRef.current = 1000 / dt;
    }
    lastDetectRef.current = now;
    tickRef.current += 1;

    try {
      const faceRes = faceLm.detectForVideo(video, now);
      const faces = faceRes?.faceLandmarks || [];
      const faceCount = faces.length;

      // ---- head pose + eye gaze (only with exactly one face) ----
      let yaw = 0, pitch = 0, gazeX = 0.5, gazeY = 0.5;
      let hasGaze = false;
      if (faceCount === 1) {
        if (faceRes.facialTransformationMatrixes?.[0]?.data) {
          ({ yaw, pitch } = headAnglesFromMatrix(faceRes.facialTransformationMatrixes[0].data));
        }
        const lm = faces[0];
        if (lm.length >= 478) {
          const lg = eyeGaze(lm, L);
          const rg = eyeGaze(lm, R);
          const rawX = (lg.gx + rg.gx) / 2;
          const rawY = (lg.gy + rg.gy) / 2;
          smoothGazeRef.current.x += (rawX - smoothGazeRef.current.x) * GAZE_SMOOTH;
          smoothGazeRef.current.y += (rawY - smoothGazeRef.current.y) * GAZE_SMOOTH;
          gazeX = smoothGazeRef.current.x;
          gazeY = smoothGazeRef.current.y;
          hasGaze = true;
        }
      }

      const armed = enabledRef.current && !calibratingRef.current;

      // Object detection is heavier — only when armed, every Nth tick.
      if (armed && objectDetectorRef.current && tickRef.current % OBJECT_DETECT_EVERY === 0) {
        const objRes = objectDetectorRef.current.detectForVideo(video, now);
        const dets = objRes?.detections || [];
        phonePresentRef.current = dets.some(
          (d) => d.categories?.[0]?.categoryName === "cell phone" && d.categories[0].score >= 0.5
        );
        personCountRef.current = dets.filter(
          (d) => d.categories?.[0]?.categoryName === "person" && d.categories[0].score >= 0.5
        ).length;
      }

      // Deviations from the calibrated neutral pose.
      const base = baselineRef.current;
      const dYaw = yaw - base.yaw;
      const dPitch = pitch - base.pitch;
      const dGazeX = gazeX - base.gazeX;
      const dGazeY = gazeY - base.gazeY;
      const headAway = faceCount === 1 && (Math.abs(dYaw) > YAW_LIMIT || Math.abs(dPitch) > PITCH_LIMIT);
      const gazeAway = hasGaze && (Math.abs(dGazeX) > GAZE_X_LIMIT || Math.abs(dGazeY) > GAZE_Y_LIMIT);
      const lookingAway = headAway || gazeAway;

      metricsRef.current = {
        ready: true, phase: "detecting", lastError: null,
        faceCount, phonePresent: phonePresentRef.current, personCount: personCountRef.current,
        yaw, pitch, gazeX, gazeY, dYaw, dPitch, dGazeX, dGazeY,
        headAway, gazeAway, lookingAway, baseline: base, armed,
        delegate: delegateRef.current, fps: fpsRef.current,
        readyState: video.readyState, videoWidth: video.videoWidth,
        detectErrors: detectErrorsRef.current, calibSamples: calibSamplesRef.current,
        held: sinceRef.current, now,
      };

      if (armed) {
        evaluate("no-face", faceCount === 0, now);
        evaluate("multiple-faces", faceCount >= 2 || personCountRef.current >= 2, now);
        evaluate("phone-detected", phonePresentRef.current, now);
        evaluate("looking-away", lookingAway, now);
      }
      detectErrorsRef.current = 0; // a clean tick clears the error streak
    } catch (e) {
      detectErrorsRef.current += 1;
      // Surface the failure (was previously swallowed → overlay showed all dashes).
      snap("detect-threw", { lastError: String(e?.message || e) });
      if (import.meta.env.DEV) console.warn("[proctoring] detect error", e);

      // Persistent failure ⇒ the browser can't run MediaPipe (no WebGL/GPU).
      // Stop the loop so we don't peg the CPU; let the interview continue.
      if (detectErrorsRef.current >= MAX_DETECT_ERRORS) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        snap("disabled-no-webgl", { lastError: String(e?.message || e) });
        setStatus("unsupported");
        console.error(
          "[proctoring] camera detection disabled after repeated WebGL failures — " +
            "enable hardware acceleration in your browser (chrome://gpu) to use camera proctoring."
        );
      }
    }
  }, [evaluate]);

  // Collect ~durationMs of samples while the candidate looks at center, then set
  // the neutral baseline. Resolves true if it captured usable samples.
  const calibrate = useCallback((durationMs = 2500) => {
    return new Promise((resolve) => {
      calibratingRef.current = true;
      const samples = [];
      const startT = performance.now();
      const collect = () => {
        const m = metricsRef.current;
        if (m?.ready && m.faceCount === 1) {
          samples.push({ yaw: m.yaw, pitch: m.pitch, gazeX: m.gazeX, gazeY: m.gazeY });
        }
        if (performance.now() - startT < durationMs) {
          setTimeout(collect, 100);
        } else {
          calibSamplesRef.current = samples.length; // <3 ⇒ unusable baseline (surfaced in debug)
          if (samples.length >= 3) {
            baselineRef.current = {
              yaw: avg(samples, "yaw"), pitch: avg(samples, "pitch"),
              gazeX: avg(samples, "gazeX"), gazeY: avg(samples, "gazeY"),
            };
          }
          calibratingRef.current = false;
          resolve(samples.length >= 3);
        }
      };
      collect();
    });
  }, []);

  // Returns { ok } on success, or { ok:false, reason, message } so the caller can
  // show the *actual* cause (camera vs model load) instead of a generic message.
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return { ok: false, reason: "unsupported",
        message: "This browser can't access the camera. Please use desktop Chrome, Edge or Firefox." };
    }
    setStatus("loading");

    // 1) Camera + microphone are BOTH required, requested in ONE prompt. Doing it
    // here (a user gesture, before detection is armed) means the browser won't pop
    // the mic prompt later mid-interview, where its window-blur would trip a strike.
    // If either is missing or denied, the request throws and the interview won't
    // start. We keep only the video track for ML — granting audio is enough for
    // SpeechRecognition not to re-prompt.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getAudioTracks().forEach((t) => t.stop()); // permission kept; track not needed
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("[proctoring] camera/mic permission failed:", err);
      setStatus("denied");
      return { ok: false, reason: "denied",
        message: "Both camera and microphone access are required for this proctored interview. Please allow them and try again." };
    }

    // 2) Load the MediaPipe models. Try the GPU delegate, fall back to CPU — the
    // GPU (WebGL) delegate can fail when hardware acceleration is off.
    let fileset;
    const createTask = async (TaskClass, modelUrl, extra) => {
      const opts = { runningMode: "VIDEO", ...extra };
      try {
        const task = await TaskClass.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" }, ...opts,
        });
        delegateRef.current = "GPU";
        return task;
      } catch (gpuErr) {
        console.warn("[proctoring] GPU delegate failed, retrying on CPU:", gpuErr);
        const task = await TaskClass.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" }, ...opts,
        });
        delegateRef.current = "CPU"; // CPU = heavy main-thread inference = likely lag
        return task;
      }
    };

    try {
      const { FilesetResolver, FaceLandmarker, ObjectDetector } = await import("@mediapipe/tasks-vision");
      fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      // numFaces:1 — single-face tracking is far cheaper; a 2nd person is still
      // caught via the ObjectDetector person count in the "multiple-faces" rule.
      faceLandmarkerRef.current = await createTask(FaceLandmarker, FACE_MODEL_URL, {
        numFaces: 1, outputFacialTransformationMatrixes: true,
      });
      objectDetectorRef.current = await createTask(ObjectDetector, OBJECT_MODEL_URL, {
        scoreThreshold: 0.5, maxResults: 5,
      });
    } catch (err) {
      console.error("[proctoring] failed to load detection models:", err);
      // Models failed — don't leave the camera light on.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus("error");
      return { ok: false, reason: "model-load",
        message: "Couldn't load the proctoring models. This is usually a network or ad/script-blocker issue blocking the model CDN — disable blockers for this site (or self-host the models) and try again." };
    }

    setStatus("ready");
    loop(); // kicks the self-scheduling detection timer
    return { ok: true };
  }, [loop]);

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
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

  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, status, startCamera, stopCamera, calibrate, metricsRef };
}
