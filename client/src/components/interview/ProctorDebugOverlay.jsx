import React, { useEffect, useState } from "react";
import { PROCTOR_TUNABLES } from "../../hooks/useCameraProctoring";

/**
 * Dev-only live view of the camera-proctoring detection metrics.
 *
 * The detection loop never re-renders React (it writes to a ref), so this overlay
 * polls `metricsRef` on its own light interval and prints what the pipeline sees:
 * which inference backend won (CPU = likely lag), whether a face is found, the head
 * pose / gaze deltas vs the calibrated baseline, and how long each violation reason
 * has been continuously "held" toward its strike threshold. That makes "the camera
 * does nothing" diagnosable at a glance.
 *
 * Render this ONLY in dev / behind ?debug — never in a real proctored session.
 *
 * @param metricsRef ref returned by useCameraProctoring (via useInterviewProctoring)
 * @param camStatus  camera/model status string
 */
const T = PROCTOR_TUNABLES;
const REASONS = [
  ["no-face", "no face"],
  ["multiple-faces", "2+ people"],
  ["phone-detected", "phone"],
  ["looking-away", "looking away"],
];

const fmt = (n, d = 1) => (typeof n === "number" ? n.toFixed(d) : "—");

function Row({ label, value, bad, good }) {
  const color = bad ? "#fca5a5" : good ? "#86efac" : "#d4d4d8";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#71717a" }}>{label}</span>
      <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function ProctorDebugOverlay({ metricsRef, camStatus }) {
  const [m, setM] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setM({ ...(metricsRef?.current || {}) }), 200);
    return () => clearInterval(id);
  }, [metricsRef]);

  if (!m) return null;

  return (
    <div
      style={{
        position: "fixed", top: 12, left: 12, zIndex: 60, width: 260,
        background: "rgba(8,8,8,0.86)", border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 10, padding: "10px 12px", color: "#e4e4e7",
        font: "11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace",
        backdropFilter: "blur(6px)", pointerEvents: "none",
      }}
    >
      <div style={{ color: "#a1a1aa", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
        PROCTOR DEBUG
      </div>

      <Row label="phase" value={m.phase || "—"} good={m.phase === "detecting"} bad={!!m.phase && m.phase !== "detecting"} />
      {m.lastError && (
        <div style={{ color: "#fca5a5", whiteSpace: "normal", margin: "2px 0 4px" }}>⚠ {m.lastError}</div>
      )}
      <Row label="backend" value={m.delegate || "—"} bad={m.delegate === "CPU"} good={m.delegate === "GPU"} />
      <Row label="cam status" value={camStatus} good={camStatus === "ready"} />
      <Row label="video ready" value={`rs${m.readyState ?? "—"} / ${m.videoWidth ?? "—"}px`} bad={(m.readyState ?? 0) < 2 || !(m.videoWidth > 0)} />
      <Row label="detect fps" value={fmt(m.fps)} bad={m.fps > 0 && m.fps < 2} />
      <Row label="detect errors" value={m.detectErrors ?? 0} bad={(m.detectErrors ?? 0) > 0} />
      <Row label="calib samples" value={m.calibSamples ?? 0} bad={(m.calibSamples ?? 0) < 3} />
      <Row label="armed" value={String(!!m.armed)} good={m.armed} bad={m.ready && !m.armed} />

      <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "7px 0" }} />

      <Row label="faces" value={m.faceCount ?? "—"} bad={m.faceCount === 0} />
      <Row label="people (obj)" value={m.personCount ?? "—"} bad={(m.personCount ?? 0) >= 2} />
      <Row label="phone" value={String(!!m.phonePresent)} bad={m.phonePresent} />

      <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "7px 0" }} />

      <Row label={`yaw Δ (lim ${T.YAW_LIMIT})`} value={fmt(m.dYaw)} bad={Math.abs(m.dYaw ?? 0) > T.YAW_LIMIT} />
      <Row label={`pitch Δ (lim ${T.PITCH_LIMIT})`} value={fmt(m.dPitch)} bad={Math.abs(m.dPitch ?? 0) > T.PITCH_LIMIT} />
      <Row label={`gaze Δx (lim ${T.GAZE_X_LIMIT})`} value={fmt(m.dGazeX, 2)} bad={Math.abs(m.dGazeX ?? 0) > T.GAZE_X_LIMIT} />
      <Row label={`gaze Δy (lim ${T.GAZE_Y_LIMIT})`} value={fmt(m.dGazeY, 2)} bad={Math.abs(m.dGazeY ?? 0) > T.GAZE_Y_LIMIT} />
      <Row label="looking away" value={String(!!m.lookingAway)} bad={m.lookingAway} />

      <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "7px 0" }} />

      <div style={{ color: "#71717a", marginBottom: 2 }}>held / threshold (ms)</div>
      {REASONS.map(([key, label]) => {
        const since = m.held?.[key];
        const heldMs = since && m.now ? Math.max(0, Math.round(m.now - since)) : 0;
        const target = T.THRESHOLDS[key];
        return (
          <Row key={key} label={label} value={`${heldMs} / ${target}`} bad={heldMs >= target} good={heldMs > 0 && heldMs < target} />
        );
      })}
    </div>
  );
}

export default ProctorDebugOverlay;
