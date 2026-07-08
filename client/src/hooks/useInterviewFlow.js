import { useState, useEffect, useRef, useCallback } from "react";
import {
  submitAnswer as apiSubmitAnswer,
  finishInterview as apiFinish,
} from "../utils/interviewApi";

/**
 * Drives the question flow: the intro, the live question list (which can grow when
 * the interviewer injects a follow-up), the per-question countdown, answer
 * submission, and finishing the interview.
 *
 * @param interviewData { interviewId, userName, questions }
 * @param enabled  true once the interview has started (gates the intro/questions)
 * @param paused   true while a blocking proctoring warning is shown (pauses the clock)
 * @param speakText the TTS speak function
 * @param speech   the speech-recognition hook's return value (answer, mic controls)
 * @param onFinish called with the final report data when the interview ends
 */
export default function useInterviewFlow({
  interviewData,
  enabled,
  paused,
  speakText,
  speech,
  onFinish,
}) {
  const { interviewId, userName } = interviewData;

  // questions is state because the interviewer can inject follow-up questions
  // mid-interview (cross-questioning), which grows this list dynamically.
  const [questions, setQuestions] = useState(interviewData.questions);
  const [isIntroPhase, setIsIntroPhase] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(interviewData.questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex + 1 >= questions.length;

  // Latest-value refs so stable callbacks read live values without re-creating.
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const speakRef = useRef(speakText);
  speakRef.current = speakText;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const isSubmittingRef = useRef(false);

  // Voice comes from the backend (Microsoft Edge neural voices). Just mark TTS
  // ready so the intro can start.
  useEffect(() => {
    setSelectedVoice(true);
  }, []);

  const finishInterview = useCallback(async () => {
    const sp = speechRef.current;
    sp.stopMic();
    sp.setMicEnabled(false);
    try {
      const result = await apiFinish(interviewId);
      onFinishRef.current(result.data);
    } catch (error) {
      console.log(error);
    }
  }, [interviewId]);

  // Move to the next question (no in-interview feedback — scores/feedback are saved
  // and only shown in the final report). Accounts for a just-injected follow-up.
  const advance = useCallback(
    (addedFollowUp) => {
      const total = questionsRef.current.length + (addedFollowUp ? 1 : 0);
      speechRef.current.resetAnswer();
      if (currentIndexRef.current + 1 >= total) {
        finishInterview();
        return;
      }
      setCurrentIndex(currentIndexRef.current + 1);
    },
    [finishInterview]
  );

  const submitAnswer = useCallback(async () => {
    if (isSubmittingRef.current) return;
    const sp = speechRef.current;
    sp.stopMic();
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await apiSubmitAnswer({
        interviewId,
        questionIndex: currentIndexRef.current,
        answer: sp.answer,
        timeTaken:
          (questionsRef.current[currentIndexRef.current]?.timeLimit || 60) -
          timeLeftRef.current,
      });

      // If the interviewer cross-questioned, insert the follow-up right after the
      // current question (backend inserts at the same position).
      let addedFollowUp = false;
      if (result.data.followUp) {
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(currentIndexRef.current + 1, 0, result.data.followUp);
          return next;
        });
        addedFollowUp = true;
      }

      setIsSubmitting(false);
      isSubmittingRef.current = false;
      advance(addedFollowUp);
    } catch (error) {
      console.log(error);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [interviewId, advance]);

  // Intro, then read each question aloud. Mirrors the original sequencing.
  useEffect(() => {
    if (!selectedVoice || !enabled) return;
    const runIntro = async () => {
      if (isIntroPhase) {
        await speakRef.current(
          `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`
        );
        await speakRef.current(
          "I'll ask you a few questions. Just answer naturally, and take your time. Let's begin."
        );
        setIsIntroPhase(false);
      } else if (currentQuestion) {
        await new Promise((r) => setTimeout(r, 700));
        if (currentIndex === questions.length - 1) {
          await speakRef.current("Alright, this one might be a bit more challenging.");
        }
        await speakRef.current(currentQuestion.question, { subtitle: false });
        const sp = speechRef.current;
        if (sp.micOnRef.current) sp.startMic();
      }
    };
    runIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, isIntroPhase, currentIndex, enabled]);

  // Per-question countdown; pauses while a proctoring warning is shown.
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (paused) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntroPhase, currentIndex, paused]);

  // Reset the clock when moving to a new question.
  useEffect(() => {
    if (!isIntroPhase && currentQuestion) {
      setTimeLeft(currentQuestion.timeLimit || 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Auto-submit when the timer runs out.
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (timeLeft === 0 && !isSubmitting) submitAnswer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  return {
    questions,
    currentIndex,
    currentQuestion,
    isIntroPhase,
    timeLeft,
    isSubmitting,
    isLast,
    submitAnswer,
  };
}
