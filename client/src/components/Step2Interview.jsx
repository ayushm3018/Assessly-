import React from 'react'
import Timer from './Timer'
import AnimatedBackground from './AnimatedBackground'
import { motion } from "motion/react"
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { useState } from 'react'
import { useRef } from 'react'
import { useEffect } from 'react'
import axios from "axios"
import { ServerUrl } from '../App'
import { BsArrowRight } from 'react-icons/bs'
import { FaExpand, FaExclamationTriangle, FaVideo } from 'react-icons/fa'
import useProctoring from '../hooks/useProctoring'
import useCameraProctoring from '../hooks/useCameraProctoring'

// Fixed neural voice for the interviewer (Guy). No in-interview voice switching.
const VOICE_GENDER = "male";

// Friendly labels for camera-detection reasons shown in the warning toast.
const REASON_LABELS = {
  "phone-detected": "Phone detected",
  "multiple-faces": "Another person detected",
  "no-face": "Face not visible",
  "looking-away": "Looking away from screen",
};

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, userName } = interviewData;
  // questions is state because the interviewer can inject follow-up questions
  // mid-interview (cross-questioning), which grows this list dynamically.
  const [questions, setQuestions] = useState(interviewData.questions);
  const [isIntroPhase, setIsIntroPhase] = useState(true);

  const [isMicOn, setIsMicOn] = useState(true);
  const recognitionRef = useRef(null);
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  // Refs mirror state so the recognition callbacks (onend etc.) read live values
  // instead of stale closures captured at mount.
  const micOnRef = useRef(true);        // does the user *want* the mic listening?
  const aiPlayingRef = useRef(false);   // is the AI currently speaking?
  const runningRef = useRef(false);     // is recognition actually running right now?

  // Single place to flip AI-speaking state so the ref and state never drift apart.
  const setAISpeaking = (v) => {
    aiPlayingRef.current = v;
    setIsAIPlaying(v);
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [micError, setMicError] = useState("");
  const [interimText, setInterimText] = useState("");
  const micPermissionRef = useRef(false);

  const audioRef = useRef(null);

  // ---- Proctoring state ----
  // hasStarted gates the whole interview behind a "Start" gesture (needed for
  // fullscreen + audio autoplay). warning is the blocking overlay (tab/fullscreen);
  // cameraToast is the non-blocking warning for camera detections.
  const [hasStarted, setHasStarted] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [warning, setWarning] = useState(null);         // { count, left, reason } | null
  const [cameraToast, setCameraToast] = useState(null); // { count, left, reason } | null
  const [isStarting, setIsStarting] = useState(false);  // acquiring camera / loading models
  const [camError, setCamError] = useState("");
  const rootRef = useRef(null);
  // Remembers whether the mic was on before a warning paused it, so we can
  // restore the user's choice when they resume.
  const micWasOnRef = useRef(true);
  // Guards against concurrent strikes (e.g. camera + tab-switch) calling onFinish twice.
  const terminatedRef = useRef(false);
  const toastTimerRef = useRef(null);

  const pauseAudio = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { }
    }
    setAISpeaking(false);
  };

  // Reports a violation to the server, which owns the strike count and the
  // terminate decision. Returns { terminated } or { terminated:false, count, left }.
  const submitViolation = async (reason) => {
    const { data } = await axios.post(
      ServerUrl + "/api/interview/violation",
      { interviewId, reason },
      { withCredentials: true }
    );
    if (data.terminated) {
      if (terminatedRef.current) return { terminated: true };
      terminatedRef.current = true;
      setTerminated(true);
      setWarning(null);
      setCameraToast(null);
      stopMic();
      micOnRef.current = false;
      pauseAudio();
      exitFullscreen();
      stopCamera();
      onFinish(data); // terminated report → Step3Report
      return { terminated: true };
    }
    return { terminated: false, count: data.violationCount, left: data.warningsLeft };
  };

  // Tab/fullscreen/window violations → BLOCKING overlay (pause the interview).
  const handleViolation = async (reason) => {
    if (terminatedRef.current) return;
    micWasOnRef.current = micOnRef.current;
    micOnRef.current = false; // stops the recognition auto-restart loop
    stopMic();
    pauseAudio();

    try {
      const r = await submitViolation(reason);
      if (r.terminated) return;
      setWarning({ count: r.count, left: r.left, reason });
    } catch (error) {
      console.log(error);
      // On a network failure, let the candidate continue rather than trap them.
      micOnRef.current = micWasOnRef.current;
      if (micOnRef.current) startMic();
    }
  };

  // Camera detections → NON-BLOCKING toast; the interview keeps running.
  const handleCameraViolation = async (reason) => {
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
  };

  const { enterFullscreen, exitFullscreen, isFullscreen } = useProctoring({
    enabled: hasStarted && !terminated,
    onViolation: handleViolation,
  });

  const { videoRef: camVideoRef, status: camStatus, startCamera, stopCamera } = useCameraProctoring({
    enabled: hasStarted && !terminated,
    onViolation: handleCameraViolation,
  });

  // Begin the interview: camera is mandatory; the click is the gesture that
  // fullscreen + audio autoplay require.
  const startInterview = async () => {
    if (isStarting) return;
    setCamError("");
    setIsStarting(true);
    const ok = await startCamera(); // getUserMedia(video) + load ML models
    if (!ok) {
      setIsStarting(false);
      setCamError("Camera access is required for this proctored interview. Please allow your camera and try again.");
      return;
    }
    await enterFullscreen(rootRef.current);
    setIsStarting(false);
    setHasStarted(true);
  };

  // Dismiss a warning and resume (used once the candidate is back on-screen).
  const resumeAfterWarning = async () => {
    if (!isFullscreen) await enterFullscreen(rootRef.current);
    setWarning(null);
    micOnRef.current = micWasOnRef.current;
    if (micOnRef.current) startMic();
  };

  // Reactive (Siri-style) orb: driven by speech activity, applied straight to the
  // DOM in a rAF loop so it never triggers React re-renders.
  const coreRef = useRef(null);
  const haloRef = useRef(null);
  const levelRef = useRef(0);        // smoothed displayed loudness 0..1
  const voiceLevelRef = useRef(0);   // spikes when the user speaks, then decays
  const rafRef = useRef(null);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    // Voice comes from the backend (Microsoft Edge neural voices). Just mark TTS
    // ready so the intro can start.
    setSelectedVoice(true);
  }, [])

  // Orb animation loop. While the AI speaks: a lively pulse. While listening: the
  // orb glows in proportion to recent speech activity (bumped in onresult) and
  // fades when you're silent.
  useEffect(() => {
    const tick = () => {
      let target = 0;
      if (aiPlayingRef.current) {
        const t = performance.now() / 1000;
        target = Math.min(1, 0.32 + 0.3 * Math.abs(Math.sin(t * 6)) + 0.16 * Math.abs(Math.sin(t * 10.3 + 1)));
      } else {
        target = voiceLevelRef.current;
      }
      voiceLevelRef.current *= 0.9; // decay speech spikes
      levelRef.current += (target - levelRef.current) * 0.2;
      const l = levelRef.current;
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + l * 0.2})`;
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${1 + l * 0.8})`;
        haloRef.current.style.opacity = `${0.3 + l * 0.6}`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [])

  // Explicitly request microphone permission up front so the browser shows its
  // standard prompt (webkitSpeechRecognition alone often doesn't surface it).
  useEffect(() => {
    if (!hasStarted) return;
    let cancelled = false;
    const askPermission = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("This browser can't access the microphone — you can type your answers instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // recognition opens its own stream
        if (!cancelled) {
          micPermissionRef.current = true;
          setMicError("");
          if (micOnRef.current) startMic();
        }
      } catch {
        if (!cancelled) {
          micPermissionRef.current = false;
          micOnRef.current = false;
          setIsMicOn(false);
          setMicError("Microphone blocked. Allow mic access in your browser to answer by voice, or type your answer.");
        }
      }
    };
    askPermission();
    return () => { cancelled = true; };
  }, [hasStarted])


  /* ---------------- SPEAK FUNCTION ---------------- */
  // Fetches neural-voice audio (MP3) and plays it. Awaitable: resolves once the AI
  // has finished speaking. The question/feedback are shown on screen so they are
  // spoken with subtitle suppressed (no duplicate text).
  const speakText = async (text, { subtitle = true } = {}) => {
    if (!text) return;
    try {
      setSubtitle(subtitle ? text : "");

      const result = await axios.post(
        ServerUrl + "/api/interview/tts",
        { text, gender: VOICE_GENDER },
        { withCredentials: true, responseType: "blob" }
      );

      const audioUrl = URL.createObjectURL(result.data);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      setAISpeaking(true);
      stopMic();

      await new Promise((resolve) => {
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });

      setAISpeaking(false);
      URL.revokeObjectURL(audioUrl);

      if (micOnRef.current) startMic();

      await new Promise((r) => setTimeout(r, 250));
      setSubtitle("");
    } catch (error) {
      console.log(error);
      setAISpeaking(false);
      setSubtitle("");
    }
  };


  useEffect(() => {
    if (!selectedVoice || !hasStarted) return;
    const runIntro = async () => {
      if (isIntroPhase) {
        await speakText(`Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`);
        await speakText("I'll ask you a few questions. Just answer naturally, and take your time. Let's begin.");
        setIsIntroPhase(false)
      } else if (currentQuestion) {
        await new Promise(r => setTimeout(r, 700));
        if (currentIndex === questions.length - 1) {
          await speakText("Alright, this one might be a bit more challenging.");
        }
        await speakText(currentQuestion.question, { subtitle: false });
        if (micOnRef.current) startMic();
      }
    }
    runIntro()
  }, [selectedVoice, isIntroPhase, currentIndex, hasStarted])


  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (warning) return; // pause the clock while a proctoring warning is shown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1
      })
    }, 1000);
    return () => clearInterval(timer)
  }, [isIntroPhase, currentIndex, warning])

  useEffect(() => {
    if (!isIntroPhase && currentQuestion) {
      setTimeLeft(currentQuestion.timeLimit || 60);
    }
  }, [currentIndex]);


  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicError("Voice input isn't supported in this browser (Chrome works best) — you can type your answers.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => { runningRef.current = true; };

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalChunk += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      if (finalChunk) setAnswer((prev) => (prev ? prev + " " : "") + finalChunk.trim());
      setInterimText(interim);
      // Speech detected → make the orb glow (decays in the rAF loop).
      voiceLevelRef.current = 1;
    };

    recognition.onend = () => {
      runningRef.current = false;
      setInterimText("");
      if (micOnRef.current && !aiPlayingRef.current) {
        setTimeout(() => {
          if (micOnRef.current && !aiPlayingRef.current && !runningRef.current) {
            try { recognition.start(); } catch { }
          }
        }, 250);
      }
    };

    recognition.onerror = (e) => {
      runningRef.current = false;
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        micPermissionRef.current = false;
        micOnRef.current = false;
        setIsMicOn(false);
        setMicError("Microphone blocked. Allow mic access in your browser to answer by voice, or type your answer.");
      } else if (e?.error === "network") {
        setMicError("Voice recognition can't reach the speech service (network/browser block). Try Chrome, or type your answer.");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch { }
      try { recognition.abort(); } catch { }
    };
  }, []);


  const startMic = () => {
    const rec = recognitionRef.current;
    if (!rec || aiPlayingRef.current || runningRef.current) return;
    if (!micPermissionRef.current) return;
    try { rec.start(); } catch { /* already started — ignore */ }
  };

  const stopMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.abort(); } catch { }
    runningRef.current = false;
    setInterimText("");
  };

  const toggleMic = async () => {
    const next = !isMicOn;
    setIsMicOn(next);
    micOnRef.current = next;
    if (next) {
      if (!micPermissionRef.current && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
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
  };

  // Move to the next question (no in-interview feedback — scores/feedback are saved
  // and only shown in the final report). Accounts for a just-injected follow-up.
  const advance = (addedFollowUp) => {
    const total = questions.length + (addedFollowUp ? 1 : 0);
    setAnswer("");
    setInterimText("");
    if (currentIndex + 1 >= total) {
      finishInterview();
      return;
    }
    setCurrentIndex(currentIndex + 1);
  };

  const submitAnswer = async () => {
    if (isSubmitting) return;
    stopMic()
    setIsSubmitting(true)
    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer,
        timeTaken: (currentQuestion?.timeLimit || 60) - timeLeft,
      }, { withCredentials: true })

      // If the interviewer cross-questioned, insert the follow-up right after the
      // current question (backend inserts at the same position).
      let addedFollowUp = false;
      if (result.data.followUp) {
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(currentIndex + 1, 0, result.data.followUp);
          return next;
        });
        addedFollowUp = true;
      }

      setIsSubmitting(false)
      advance(addedFollowUp)
    } catch (error) {
      console.log(error)
      setIsSubmitting(false)
    }
  }

  const finishInterview = async () => {
    stopMic()
    setIsMicOn(false)
    micOnRef.current = false
    try {
      const result = await axios.post(ServerUrl + "/api/interview/finish", { interviewId }, { withCredentials: true })
      onFinish(result.data)
    } catch (error) {
      console.log(error)
    }
  }

  // Auto-submit when the timer runs out.
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (timeLeft === 0 && !isSubmitting) submitAnswer()
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { }
        try { recognitionRef.current.abort(); } catch { }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);


  const isLast = currentIndex + 1 >= questions.length;
  const statusText = isAIPlaying
    ? "AI interviewer is speaking"
    : isMicOn
      ? "Listening to your answer…"
      : "Microphone muted";

  // progress entries based on the live (possibly follow-up-grown) questions array
  const progress = questions.map((q, i) => {
    let state = "upcoming";
    if (q.isFollowUp) state = i < currentIndex ? "done" : i === currentIndex ? "current" : "followup";
    else if (i < currentIndex) state = "done";
    else if (i === currentIndex) state = "current";
    return { ...q, state, i };
  });

  const dotStyle = (state) => {
    if (state === "done") return { background: 'linear-gradient(135deg,#e8e8e8,#a0a0a0)', border: '1px solid transparent', boxShadow: 'none', color: '#c8c8cf' };
    if (state === "current") return { background: 'linear-gradient(135deg,#e8e8e8,#a0a0a0)', border: '1px solid transparent', boxShadow: '0 0 10px rgba(200,200,200,0.6)', color: '#fafafa' };
    if (state === "followup") return { background: '#f59e0b', border: '1px solid transparent', boxShadow: '0 0 10px rgba(245,158,11,0.5)', color: '#fbbf24' };
    return { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none', color: '#7d7d86' };
  };

  // ===================== PRE-START GATE =====================
  // Clicking "Start" provides the user gesture that fullscreen + audio require,
  // and sets expectations about the proctoring rules.
  if (!hasStarted) {
    return (
      <div ref={rootRef} className='relative h-screen overflow-hidden flex items-center justify-center px-6'
        style={{ background: '#080808', color: '#f4f4f5' }}>
        <AnimatedBackground />
        <div className='relative z-10 w-full max-w-lg glass rounded-3xl p-8 sm:p-10 text-center'>
          <div className='w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5'
            style={{ background: 'var(--accent-grad)', color: '#0a0a0a' }}>
            <FaExpand size={22} />
          </div>
          <h2 className='text-2xl font-light tracking-tight text-zinc-50'>Proctored interview</h2>
          <p className='text-sm text-zinc-400 font-light mt-3 leading-relaxed'>
            This interview runs in fullscreen and is monitored by camera for integrity.
            Your camera feed is analysed on your device and never leaves it.
          </p>

          <div className='text-left mt-6 flex flex-col gap-3'>
            {[
              "Leaving fullscreen, switching tabs, or switching apps is recorded.",
              "Your camera is checked for a phone, another person, or you leaving / looking away.",
              "You get 3 warnings total — each violation counts as one.",
              "On the 3rd violation the interview ends automatically with a score of 0.",
            ].map((rule, i) => (
              <div key={i} className='flex items-start gap-3'>
                <span className='flex-none mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-[#0a0a0a]'
                  style={{ background: 'var(--accent-grad)' }}>{i + 1}</span>
                <span className='text-sm text-zinc-300 font-light leading-relaxed'>{rule}</span>
              </div>
            ))}
          </div>

          {camError && (
            <p className='text-sm font-light mt-5 leading-relaxed' style={{ color: '#fca5a5' }}>{camError}</p>
          )}

          <button onClick={startInterview} disabled={isStarting}
            className='btn-metal w-full mt-8 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'>
            {isStarting
              ? "Preparing proctoring…"
              : <>Start Interview <BsArrowRight size={18} /></>}
          </button>
          <p className='text-[11px] text-zinc-600 mt-4'>Use a desktop browser (Chrome recommended) and allow camera + microphone access.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className='relative h-screen overflow-hidden' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

      {/* ===================== PROCTORING WARNING OVERLAY ===================== */}
      {warning && (
        <div className='absolute inset-0 z-50 flex items-center justify-center px-6'
          style={{ background: 'rgba(8,8,8,0.86)', backdropFilter: 'blur(6px)' }}>
          <div className='w-full max-w-md glass rounded-3xl p-8 text-center border'
            style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
            <div className='w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5'
              style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              <FaExclamationTriangle size={24} />
            </div>
            <h3 className='text-xl font-medium text-amber-300'>Warning {warning.count} of 3</h3>
            <p className='text-sm text-zinc-300 font-light mt-3 leading-relaxed'>
              Leaving the interview screen was detected. {warning.left === 1
                ? "One more violation will end the interview with a score of 0."
                : `${warning.left} warnings left before the interview is terminated.`}
            </p>
            <button onClick={resumeAfterWarning}
              className='btn-metal w-full mt-7 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2'>
              {isFullscreen ? "Resume interview" : <><FaExpand size={15} /> Return to fullscreen</>}
            </button>
          </div>
        </div>
      )}

      {/* ===================== CAMERA WARNING TOAST (non-blocking) ===================== */}
      {cameraToast && (
        <div className='absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl glass border'
          style={{ borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(20,16,8,0.92)' }}>
          <FaExclamationTriangle style={{ color: '#fbbf24' }} size={18} />
          <div className='text-left'>
            <div className='text-sm font-semibold text-amber-300'>
              Warning {cameraToast.count} of 3 — {REASON_LABELS[cameraToast.reason] || "Suspicious activity"}
            </div>
            <div className='text-[12px] text-zinc-400 font-light'>
              {cameraToast.left === 1
                ? "One more violation ends the interview with a score of 0."
                : `${cameraToast.left} warnings left.`}
            </div>
          </div>
        </div>
      )}

      {/* ===================== SELF-VIEW PREVIEW ===================== */}
      <div className='absolute bottom-5 right-5 z-40 rounded-xl overflow-hidden border border-white/15 shadow-lg'
        style={{ width: 160, height: 120, background: '#000' }}>
        <video ref={camVideoRef} autoPlay muted playsInline
          className='w-full h-full object-cover -scale-x-100' />
        <div className='absolute bottom-1 left-1.5 flex items-center gap-1.5 text-[10px] text-zinc-200 font-medium'>
          <FaVideo size={10} style={{ color: camStatus === 'ready' ? '#34d399' : '#f59e0b' }} />
          {camStatus === 'ready' ? 'Monitoring' : 'Camera…'}
        </div>
      </div>

      <div className='relative z-10 h-screen overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_280px]'>

        {/* ===================== MAIN STAGE ===================== */}
        <div className='relative flex flex-col items-center justify-center gap-4 px-6 py-6 overflow-hidden'>

          {/* question */}
          <div className='text-center max-w-3xl'>
            <div className='text-[11px] tracking-[0.28em] uppercase text-zinc-500 font-semibold mb-3'>
              {isIntroPhase ? "Introduction" : `Question ${currentIndex + 1} of ${questions.length}`}
            </div>
            <h2 className='font-extralight tracking-tight leading-snug text-zinc-50'
              style={{ fontSize: 'clamp(20px,2.3vw,30px)' }}>
              {isIntroPhase ? "Let's get you settled in." : currentQuestion?.question}
            </h2>
          </div>

          {/* reactive Siri-style glowing orb */}
          <div className='relative flex items-center justify-center' style={{ width: 200, height: 200 }}>
            <div ref={haloRef} className='absolute rounded-full'
              style={{ width: 170, height: 170, background: 'radial-gradient(circle, rgba(196,200,240,0.6), rgba(120,118,235,0.20) 55%, transparent 72%)', filter: 'blur(30px)', willChange: 'transform, opacity' }}></div>
            <div className='absolute rounded-full'
              style={{ width: 150, height: 150, background: 'conic-gradient(from 0deg, rgba(232,232,232,0.5), rgba(120,118,235,0.35), rgba(160,160,170,0.18), rgba(232,232,232,0.5))', filter: 'blur(10px)', animation: 'spinSlow 9s linear infinite', opacity: 0.6 }}></div>
            <div style={{ animation: 'orbBreath 4.2s ease-in-out infinite' }}>
              <div ref={coreRef} className='relative rounded-full'
                style={{ width: 124, height: 124, background: 'radial-gradient(circle at 38% 30%, #fbfbfe, #c4c6e2 42%, #8281c4 78%, #5b5aa6 100%)', boxShadow: 'inset 0 0 30px rgba(255,255,255,0.55), inset 0 -16px 32px rgba(70,68,140,0.5), 0 0 50px rgba(150,150,220,0.4)', willChange: 'transform' }}>
                <div className='absolute rounded-full' style={{ top: '15%', left: '22%', width: '42%', height: '30%', background: 'radial-gradient(circle, rgba(255,255,255,0.95), transparent 70%)', filter: 'blur(3px)' }}></div>
              </div>
            </div>
          </div>

          {/* status / live transcription */}
          <div className='min-h-[40px] max-w-xl text-center px-2 flex items-center justify-center'>
            {subtitle
              ? <p className='text-sm text-zinc-300 font-light leading-relaxed'>{subtitle}</p>
              : micError
                ? <p className='text-sm font-light leading-relaxed' style={{ color: '#fca5a5' }}>{micError}</p>
                : interimText
                  ? <p className='text-sm text-zinc-300 font-light leading-relaxed italic'>“{interimText}”</p>
                  : <p className='text-sm text-zinc-500 font-light'>{statusText}</p>}
          </div>

          {/* timer */}
          <div className='flex items-center gap-3 px-4 py-2 rounded-full glass'>
            {isAIPlaying
              ? <span className='text-xs text-metal font-semibold tracking-wide'>AI Speaking</span>
              : <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} />}
          </div>

          {/* answer + controls (no in-interview feedback) */}
          {!isIntroPhase && (
            <div className='w-full max-w-2xl glass rounded-2xl p-4'>
              <textarea
                placeholder="Speak, or type your answer here…"
                onChange={(e) => setAnswer(e.target.value)}
                value={answer}
                rows={2}
                className='w-full bg-white/[0.03] p-3 rounded-xl resize-none outline-none border border-white/10 focus:border-[rgba(192,192,192,0.55)] transition text-zinc-100 text-sm' />
              <div className='flex items-center gap-3 mt-3'>
                <motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.9 }}
                  className='w-11 h-11 flex-none flex items-center justify-center rounded-full transition'
                  style={isMicOn
                    ? { background: 'var(--accent-grad)', color: '#0a0a0a', boxShadow: '0 0 24px rgba(200,200,200,0.18)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {isMicOn ? <FaMicrophone size={17} /> : <FaMicrophoneSlash size={17} />}
                </motion.button>
                <motion.button
                  onClick={submitAnswer}
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.97 }}
                  className='flex-1 btn-metal py-3 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5'>
                  {isSubmitting ? "Submitting..." : isLast ? "Submit & Finish" : "Submit & Next"}
                  {!isSubmitting && <BsArrowRight size={18} />}
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* ===================== PROGRESS PANEL ===================== */}
        <aside className='hidden lg:flex flex-col gap-5 border-l border-white/5 px-7 py-10 overflow-hidden'>
          <div className='text-xs tracking-[0.2em] uppercase text-zinc-500 font-semibold'>Progress</div>
          <div className='flex flex-col gap-3.5 overflow-y-auto'>
            {progress.map((p) => {
              const s = dotStyle(p.state);
              return (
                <div key={p.i} className='flex items-center gap-3'>
                  <span className='flex-none w-3.5 h-3.5 rounded-full' style={{ background: s.background, border: s.border, boxShadow: s.boxShadow }}></span>
                  <span className='text-[13px] font-light truncate' style={{ color: s.color }}>
                    {p.isFollowUp ? "Follow-up probe" : `Question ${p.i + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className='mt-auto grid grid-cols-2 gap-3'>
            <div className='glass rounded-xl px-4 py-3 text-center'>
              <div className='text-2xl font-extralight text-zinc-50'>{currentIndex + 1}</div>
              <div className='text-[11px] text-zinc-500'>Current</div>
            </div>
            <div className='glass rounded-xl px-4 py-3 text-center'>
              <div className='text-2xl font-extralight text-zinc-50'>{questions.length}</div>
              <div className='text-[11px] text-zinc-500'>Total</div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  )
}

export default Step2Interview
