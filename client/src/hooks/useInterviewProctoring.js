import { useState, useRef, useEffect, useCallback } from "react";
import useProctoring from "./useProctoring";
import useCameraProctoring from "./useCameraProctoring";
import { recordViolation } from "../utils/interviewApi";

/**
 * Orchestrates the full proctoring session on top of the two detection hooks:
 *  - useProctoring     → tab-switch / exit-fullscreen / window-blur (blocking warning)
 *  - useCameraProctoring → phone / second person / absent / looking away (non-blocking toast)
 *
 * Both feed one server-authoritative violation budget. The server owns the strike
 * count and the terminate decision; this hook only reports violations and reflects
 * the result (warning overlay, camera toast, or termination).
 *
 * The hook never touches the mic/audio directly — the component passes a `media`
 * object ({ pause, resume, stop }) so we can pause/resume/stop the candidate's
 * media on warning / resume / terminate without coupling to speech or TTS.
 *
 * @param interviewId
 * @param rootRef   the element to request fullscreen on
 * @param onFinish  called with the terminated report when the interview is terminated
 * @param media     { pause(), resume(), stop() } — mic + audio control
 */
export default function useInterviewProctoring({ interviewId, rootRef, onFinish, media }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [warning, setWarning] = useState(null); // { count, left, reason } | null
  const [cameraToast, setCameraToast] = useState(null); // { count, left, reason } | null
  const [isStarting, setIsStarting] = useState(false);
  const [camError, setCamError] = useState("");

  // Guards against concurrent strikes (e.g. camera + tab-switch) terminating twice.
  const terminatedRef = useRef(false);
  const toastTimerRef = useRef(null);
  const isStartingRef = useRef(false);

  // Latest-value refs so the stable callbacks below always reach the live deps.
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  // Filled in after the detection hooks return (read only at call-time).
  const fsRef = useRef({});
  const camRef = useRef({});

  // Reports a violation to the server, which owns the strike count and the
  // terminate decision. Returns { terminated } or { terminated:false, count, left }.
  const submitViolation = useCallback(
    async (reason) => {
      const { data } = await recordViolation(interviewId, reason);
      if (data.terminated) {
        if (terminatedRef.current) return { terminated: true };
        terminatedRef.current = true;
        setTerminated(true);
        setWarning(null);
        setCameraToast(null);
        mediaRef.current.stop();
        fsRef.current.exitFullscreen?.();
        camRef.current.stopCamera?.();
        onFinishRef.current(data); // terminated report → Step3Report
        return { terminated: true };
      }
      return { terminated: false, count: data.violationCount, left: data.warningsLeft };
    },
    [interviewId]
  );

  // Tab/fullscreen/window violations → BLOCKING overlay (pause the interview).
  const handleViolation = useCallback(
    async (reason) => {
      if (terminatedRef.current) return;
      mediaRef.current.pause();
      try {
        const r = await submitViolation(reason);
        if (r.terminated) return;
        setWarning({ count: r.count, left: r.left, reason });
      } catch (error) {
        console.log(error);
        // On a network failure, let the candidate continue rather than trap them.
        mediaRef.current.resume();
      }
    },
    [submitViolation]
  );

  // Camera detections → NON-BLOCKING toast; the interview keeps running.
  const handleCameraViolation = useCallback(
    async (reason) => {
      if (terminatedRef.current) return;
      try {
        const r = await submitViolation(reason);
        if (r.terminated) return;
        setCameraToast({ count: r.count, left: r.left, reason });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setCameraToast(null), 5000);
      } catch (error) {
        console.log(error);
      }
    },
    [submitViolation]
  );

  const { enterFullscreen, exitFullscreen, isFullscreen } = useProctoring({
    enabled: hasStarted && !terminated,
    onViolation: handleViolation,
  });

  const {
    videoRef: camVideoRef,
    status: camStatus,
    startCamera,
    stopCamera,
    calibrate,
    metricsRef: camMetricsRef,
  } = useCameraProctoring({
    enabled: hasStarted && !terminated,
    onViolation: handleCameraViolation,
  });

  fsRef.current = { enterFullscreen, exitFullscreen, isFullscreen };
  camRef.current = { startCamera, stopCamera, calibrate };

  // Begin the interview: camera is mandatory; the click is the gesture that
  // fullscreen + audio autoplay require. After fullscreen we calibrate the gaze
  // baseline before arming detection.
  const startInterview = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCamError("");
    setIsStarting(true);
    const res = await camRef.current.startCamera(); // getUserMedia + load ML models
    if (!res.ok) {
      isStartingRef.current = false;
      setIsStarting(false);
      setCamError(res.message);
      return;
    }
    await fsRef.current.enterFullscreen(rootRef.current);
    isStartingRef.current = false;
    setIsStarting(false);
    setCalibrating(true); // → calibration screen, then hasStarted
  }, [rootRef]);

  // Run calibration once the calibration screen is on (video is mounted there).
  useEffect(() => {
    if (!calibrating) return;
    let active = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 500)); // let the dot register + camera warm up
      await camRef.current.calibrate(2500);
      if (!active) return;
      setCalibrating(false);
      setHasStarted(true); // arms detection + starts the intro
    })();
    return () => {
      active = false;
    };
  }, [calibrating]);

  // Dismiss a warning and resume (used once the candidate is back on-screen).
  const resumeAfterWarning = useCallback(async () => {
    if (!fsRef.current.isFullscreen) await fsRef.current.enterFullscreen(rootRef.current);
    setWarning(null);
    mediaRef.current.resume();
  }, [rootRef]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  return {
    hasStarted,
    calibrating,
    terminated,
    warning,
    cameraToast,
    isStarting,
    camError,
    startInterview,
    resumeAfterWarning,
    isFullscreen,
    camVideoRef,
    camStatus,
    camMetricsRef, // live detection metrics for the dev debug overlay
  };
}
