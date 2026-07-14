import { useRef, useState, useEffect, useCallback } from "react";
import { DeepgramClient } from "@deepgram/sdk";
import { deepgramToken } from "../utils/interviewApi";

/**
 * Voice answers via Deepgram real-time streaming STT — a drop-in replacement for
 * the old Web Speech hook: it exposes the exact same public interface so the
 * interview orchestrator wiring (mic mute while AI speaks, orb pulse, warning
 * pause/resume) is unchanged.
 *
 * How it works: the mic stream is acquired once up front (no mid-interview prompt
 * that would trip a window-blur strike). Each listening session fetches a short
 * ephemeral token from our server, opens a Deepgram live socket with it, and pipes
 * MediaRecorder chunks in. Interim words stream into `interimText` within ~1s;
 * finals accumulate into `answer`. The long-lived API key never reaches the browser.
 *
 * @param enabled       acquire mic permission + start once this turns true
 * @param isSpeakingRef live ref to "AI is speaking" so the mic stays muted then
 * @param onActivity    called on each transcript chunk (used to pulse the orb)
 */
const DG_OPTIONS = {
  model: "nova-2",
  language: "en-US",
  smart_format: true,
  punctuate: true,
  interim_results: true,
  endpointing: 300,
};

const pickMimeType = () => {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
};

export default function useDeepgramSpeech({ enabled, isSpeakingRef, onActivity } = {}) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState("");
  const [answer, setAnswer] = useState("");

  const micOnRef = useRef(true); // does the user *want* the mic listening?
  const micPermissionRef = useRef(false);
  const runningRef = useRef(false); // a listening session is starting/active
  const streamRef = useRef(null); // persistent mic stream
  const connRef = useRef(null); // current Deepgram live socket
  const recorderRef = useRef(null); // current MediaRecorder
  const sessionRef = useRef(0); // bumped on every start/stop to cancel stale async

  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const setMicEnabled = useCallback((v) => {
    setIsMicOn(v);
    micOnRef.current = v;
  }, []);

  const resetAnswer = useCallback(() => {
    setAnswer("");
    setInterimText("");
  }, []);

  // Tear down the current recorder + socket (does not touch the persistent stream).
  const teardown = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch {}
    }
    const conn = connRef.current;
    connRef.current = null;
    if (conn) {
      try { conn.sendCloseStream?.({}); } catch {}
      try { conn.close(); } catch {}
    }
  }, []);

  const stopMic = useCallback(() => {
    sessionRef.current += 1; // cancels any in-flight startMic
    runningRef.current = false;
    teardown();
    setInterimText("");
  }, [teardown]);

  const startMic = useCallback(async () => {
    if (isSpeakingRef?.current || runningRef.current) return;
    if (!micPermissionRef.current || !streamRef.current) return;
    if (!window.MediaRecorder) {
      setMicError("This browser can't record audio — you can type your answer instead.");
      return;
    }

    runningRef.current = true;
    const session = ++sessionRef.current;
    const stale = () => session !== sessionRef.current;

    try {
      const { data } = await deepgramToken();
      if (stale()) return;

      const dg = new DeepgramClient({ accessToken: data.accessToken });
      const conn = await dg.listen.v1.connect(DG_OPTIONS);
      if (stale()) {
        try { conn.close(); } catch {}
        return;
      }
      connRef.current = conn;

      conn.on("open", () => {
        if (stale()) {
          try { conn.close(); } catch {}
          return;
        }
        const mimeType = pickMimeType();
        const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
        recorderRef.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data?.size > 0 && connRef.current === conn) {
            try { conn.sendMedia(e.data); } catch {}
          }
        };
        rec.start(250); // emit a chunk every 250ms → sub-second live transcription
      });

      conn.on("message", (msg) => {
        if (stale() || msg?.type !== "Results") return;
        const transcript = msg.channel?.alternatives?.[0]?.transcript || "";
        if (!transcript) return;
        onActivityRef.current?.(); // pulse the orb
        if (msg.is_final) {
          setAnswer((prev) => (prev ? prev + " " : "") + transcript.trim());
          setInterimText("");
        } else {
          setInterimText(transcript);
        }
      });

      conn.on("error", () => {
        if (!stale()) {
          setMicError("Voice service connection issue — keep speaking, or type your answer.");
        }
      });

      conn.connect(); // sockets start closed — this initiates the connection
    } catch {
      if (!stale()) {
        runningRef.current = false;
        setMicError("Couldn't start voice transcription — check your connection, or type your answer.");
      }
    }
  }, [isSpeakingRef]);

  // Acquire the mic once the interview starts, so the browser prompts up front
  // (a mid-interview prompt would steal focus and trip a window-blur strike).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("This browser can't access the microphone — you can type your answers instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        micPermissionRef.current = true;
        setMicError("");
        if (micOnRef.current) startMic();
      } catch {
        if (!cancelled) {
          micPermissionRef.current = false;
          micOnRef.current = false;
          setIsMicOn(false);
          setMicError("Microphone blocked. Allow mic access in your browser to answer by voice, or type your answer.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, startMic]);

  // Stop everything and release the mic on unmount.
  useEffect(
    () => () => {
      sessionRef.current += 1;
      teardown();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [teardown]
  );

  const toggleMic = useCallback(async () => {
    const next = !micOnRef.current;
    setIsMicOn(next);
    micOnRef.current = next;
    if (next) {
      if (!micPermissionRef.current && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          micPermissionRef.current = true;
          setMicError("");
        } catch {
          micPermissionRef.current = false;
          micOnRef.current = false;
          setIsMicOn(false);
          setMicError("Microphone blocked. Allow mic access in your browser to answer by voice, or type your answer.");
          return;
        }
      }
      startMic();
    } else {
      stopMic();
    }
  }, [startMic, stopMic]);

  return {
    isMicOn,
    interimText,
    micError,
    answer,
    setAnswer,
    resetAnswer,
    startMic,
    stopMic,
    toggleMic,
    setMicEnabled,
    micOnRef,
    micPermissionRef,
  };
}
