import axios from "axios";
import { ServerUrl } from "../App";

// Thin transport wrappers over the interview API. These intentionally do NOT
// handle errors — callers own their own try/catch and recovery semantics.

export const ttsAudio = (text, gender) =>
  axios.post(
    ServerUrl + "/api/interview/tts",
    { text, gender },
    { withCredentials: true, responseType: "blob" }
  );

export const submitAnswer = (payload) =>
  axios.post(ServerUrl + "/api/interview/submit-answer", payload, {
    withCredentials: true,
  });

export const finishInterview = (interviewId) =>
  axios.post(
    ServerUrl + "/api/interview/finish",
    { interviewId },
    { withCredentials: true }
  );

export const recordViolation = (interviewId, reason) =>
  axios.post(
    ServerUrl + "/api/interview/violation",
    { interviewId, reason },
    { withCredentials: true }
  );

// Short-lived Deepgram token → { accessToken, expiresIn }. The browser opens its
// live speech-to-text socket with this; the long-lived key stays on the server.
export const deepgramToken = () =>
  axios.get(ServerUrl + "/api/interview/deepgram-token", { withCredentials: true });
