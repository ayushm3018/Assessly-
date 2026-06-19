import { useRef, useState, useEffect, useCallback } from "react";
import { ttsAudio } from "../utils/interviewApi";

// Fixed neural voice for the interviewer (Guy). No in-interview voice switching.
const VOICE_GENDER = "male";

/**
 * Neural text-to-speech playback for the interviewer's voice.
 *
 * `speakText(text, { subtitle })` fetches the MP3 from the backend and plays it,
 * resolving once playback ends. It fires `onStart()` right after marking the AI
 * as speaking and `onEnd()` right after it stops — the caller wires those to
 * mute / restore the mic, keeping the exact "mute while the AI speaks" sequencing
 * without this hook needing to know about speech recognition.
 *
 * Exposes `isSpeakingRef` (live, for the orb + the speech hook's restart gating)
 * alongside the `isSpeaking` state for rendering.
 */
export default function useTextToSpeech({ onStart, onEnd } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const audioRef = useRef(null);
  const isSpeakingRef = useRef(false);

  // Latest-callback refs so speakText can stay identity-stable regardless of how
  // the caller passes onStart/onEnd.
  const cbRef = useRef({ onStart, onEnd });
  cbRef.current = { onStart, onEnd };

  const setSpeaking = useCallback((v) => {
    isSpeakingRef.current = v;
    setIsSpeaking(v);
  }, []);

  // The question/feedback are already on screen, so they're spoken with the
  // subtitle suppressed (no duplicate text).
  const speakText = useCallback(
    async (text, { subtitle: showSubtitle = true } = {}) => {
      if (!text) return;
      try {
        setSubtitle(showSubtitle ? text : "");

        const result = await ttsAudio(text, VOICE_GENDER);

        const audioUrl = URL.createObjectURL(result.data);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        setSpeaking(true);
        cbRef.current.onStart?.();

        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });

        setSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        cbRef.current.onEnd?.();

        await new Promise((r) => setTimeout(r, 250));
        setSubtitle("");
      } catch (error) {
        console.log(error);
        setSpeaking(false);
        setSubtitle("");
      }
    },
    [setSpeaking]
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
    setSpeaking(false);
  }, [setSpeaking]);

  // Stop any in-flight audio if the interview screen unmounts mid-speech.
  useEffect(
    () => () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current = null;
      }
    },
    []
  );

  return { speakText, stopAudio, isSpeaking, isSpeakingRef, subtitle };
}
