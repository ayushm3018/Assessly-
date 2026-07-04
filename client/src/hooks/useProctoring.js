
import { useCallback, useEffect, useRef, useState } from "react";

// Proctoring hook for the interview surface.
//
// Reality check: a browser CANNOT prevent a user from leaving fullscreen or
// switching tabs — there is no such API by design. So this hook DETECTS those
// actions and reports them via `onViolation`; the actual penalty (strike count,
// termination, zeroed score) is decided server-side and is non-negotiable here.
//
// Signals watched (desktop only):
//   - visibilitychange → tab switch / window minimize
//   - fullscreenchange → user pressed Esc / left fullscreen
//   - window blur      → switched to another app/window (e.g. second monitor)
//
// A short cooldown collapses the multiple events one physical action fires
// (e.g. Esc fires both fullscreenchange + blur) into a single violation.
//
// Known, accepted false positive: opening devtools fires `blur` and will count.
// That is acceptable for a proctored session.

const COOLDOWN_MS = 1200; // one physical action = one strike
const ARM_DELAY_MS = 800; // skip the startup mic-permission prompt's blur

const getFullscreenElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;

const requestFs = (el) => {
  if (!el) return;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
};

const exitFs = () => {
  if (!getFullscreenElement()) return;
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
};

export default function useProctoring({ enabled, onViolation }) {
  const [isFullscreen, setIsFullscreen] = useState(!!getFullscreenElement());

  // Refs so the event listeners (registered once) always read live values.
  const armedRef = useRef(false);
  const lastViolationRef = useRef(0);
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const enterFullscreen = useCallback(async (el) => {
    try {
      await requestFs(el || document.documentElement);
    } catch {
      /* user denied / not supported — detection still applies */
    }
  }, []);

  // Fire a violation, debounced by the cooldown.
  const fireViolation = useCallback((reason) => {
    if (!armedRef.current) return;
    const now = Date.now();
    if (now - lastViolationRef.current < COOLDOWN_MS) return;
    lastViolationRef.current = now;
    onViolationRef.current?.(reason);
  }, []);

  // Arm/disarm detection based on `enabled`, with a settle delay so the
  // mic-permission prompt at startup doesn't register as a strike.
  useEffect(() => {
    if (!enabled) {
      armedRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      armedRef.current = true;
    }, ARM_DELAY_MS);
    return () => clearTimeout(t);
  }, [enabled]);

  // Register listeners once.
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!getFullscreenElement();
      setIsFullscreen(fs);
      if (!fs) fireViolation("fullscreen-exit");
    };
    const onVisibility = () => {
      if (document.hidden) fireViolation("tab-switch");
    };
    const onBlur = () => fireViolation("window-blur");

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      exitFs();
    };
  }, [fireViolation]);

  return { enterFullscreen, exitFullscreen: exitFs, isFullscreen };
}
