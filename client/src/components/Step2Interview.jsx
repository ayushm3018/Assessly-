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

// Fixed neural voice for the interviewer (Guy). No in-interview voice switching.
const VOICE_GENDER = "male";

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
  }, [])


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
    if (!selectedVoice) return;
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
  }, [selectedVoice, isIntroPhase, currentIndex])


  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1
      })
    }, 1000);
    return () => clearInterval(timer)
  }, [isIntroPhase, currentIndex])

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

  return (
    <div className='relative h-screen overflow-hidden' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

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
