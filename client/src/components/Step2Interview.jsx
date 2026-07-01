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
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(
    questions[0]?.timeLimit || 60
  );
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("female");
  const [subtitle, setSubtitle] = useState("");
  const [micError, setMicError] = useState("");
  const [interimText, setInterimText] = useState("");
  const micPermissionRef = useRef(false);

  const audioRef = useRef(null);

  const currentQuestion = questions[currentIndex];


  useEffect(() => {
    // Voice now comes from the backend (Microsoft Edge neural voices), so there's
    // no OS voice list to load. We just mark TTS ready so the intro can start.
    // voiceGender ("female"/"male") still selects the neural voice.
    setSelectedVoice(true);
  }, [])

  // Explicitly request microphone permission up front. webkitSpeechRecognition
  // manages its own audio stream and in several browsers it never surfaces the
  // standard mic prompt (so it silently captures nothing). Calling getUserMedia
  // forces the real permission prompt; recognition then has access to the mic.
  useEffect(() => {
    let cancelled = false;
    const askPermission = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError("This browser can't access the microphone — you can type your answers instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // We only needed the prompt; recognition opens its own stream.
        stream.getTracks().forEach((t) => t.stop());
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
  // Fetches neural-voice audio (MP3) from the backend and plays it. Keeps the same
  // awaitable contract as before: resolves once the AI has finished speaking.
  // The dynamic orb avatar reacts purely to `isAIPlaying` — no video / lip-sync.
  const speakText = async (text) => {
    if (!text) return;

    try {
      setSubtitle(text);

      const result = await axios.post(
        ServerUrl + "/api/interview/tts",
        { text, gender: voiceGender },
        { withCredentials: true, responseType: "blob" }
      );

      const audioUrl = URL.createObjectURL(result.data);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Start: orb enters "speaking" state, pause mic so it doesn't capture the AI voice
      setAISpeaking(true);
      stopMic();

      await new Promise((resolve) => {
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });

      // End: orb returns to "listening" state, resume mic, clear subtitle
      setAISpeaking(false);
      URL.revokeObjectURL(audioUrl);

      if (micOnRef.current) {
        startMic();
      }

      await new Promise((r) => setTimeout(r, 300));
      setSubtitle("");
    } catch (error) {
      console.log(error);
      setAISpeaking(false);
      setSubtitle("");
    }
  };


  useEffect(() => {
    if (!selectedVoice) {
      return;
    }
    const runIntro = async () => {
      if (isIntroPhase) {
        await speakText(
          `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`
        );

        await speakText(
          "I'll ask you a few questions. Just answer naturally, and take your time. Let's begin."
        );

        setIsIntroPhase(false)
      } else if (currentQuestion) {
        await new Promise(r => setTimeout(r, 800));

        // If last question (hard level)
        if (currentIndex === questions.length - 1) {
          await speakText("Alright, this one might be a bit more challenging.");
        }

        await speakText(currentQuestion.question);

        if (isMicOn) {
          startMic();
        }
      }

    }

    runIntro()


  }, [selectedVoice, isIntroPhase, currentIndex])



  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0;
        }
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
    recognition.interimResults = true; // live partial results, so you see it working

    recognition.onstart = () => {
      runningRef.current = true;
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalChunk += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      if (finalChunk) {
        setAnswer((prev) => (prev ? prev + " " : "") + finalChunk.trim());
      }
      setInterimText(interim);
    };

    // continuous recognition still ends on its own (silence, browser limits).
    // Auto-restart it as long as the user wants the mic on and the AI isn't speaking.
    recognition.onend = () => {
      runningRef.current = false;
      setInterimText("");
      if (micOnRef.current && !aiPlayingRef.current) {
        // small delay avoids a tight restart loop on transient errors
        setTimeout(() => {
          if (micOnRef.current && !aiPlayingRef.current && !runningRef.current) {
            try { recognition.start(); } catch { }
          }
        }, 250);
      }
    };

    recognition.onerror = (e) => {
      runningRef.current = false;
      // "not-allowed" means the user blocked mic permission — stop trying.
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
    if (!micPermissionRef.current) return; // wait until mic permission is granted
    try {
      rec.start();
    } catch { /* already started — ignore */ }
  };

  const stopMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    // abort() releases the mic immediately (clears the browser's recording
    // indicator), unlike stop() which can linger until the final result.
    try { rec.abort(); } catch { }
    runningRef.current = false;
    setInterimText("");
  };

  const toggleMic = async () => {
    const next = !isMicOn;
    setIsMicOn(next);
    micOnRef.current = next;
    if (next) {
      // If permission was never granted (or was denied), re-request it now —
      // this click is a user gesture, so the browser will show the prompt.
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


  const submitAnswer = async () => {
    if (isSubmitting) return;
    stopMic()
    setIsSubmitting(true)

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer,
        timeTaken:
          currentQuestion.timeLimit - timeLeft,
      }, { withCredentials: true })

      // If the interviewer decided to cross-question, insert the follow-up right
      // after the current question. The backend inserts at the same position, so
      // questionIndex stays aligned between client and server.
      if (result.data.followUp) {
        setQuestions((prev) => {
          const next = [...prev];
          next.splice(currentIndex + 1, 0, result.data.followUp);
          return next;
        });
      }

      setFeedback(result.data.feedback)
      speakText(result.data.feedback)
      setIsSubmitting(false)
    } catch (error) {
      console.log(error)
      setIsSubmitting(false)
    }
  }

  const handleNext = async () => {
    setAnswer("");
    setFeedback("");

    if (currentIndex + 1 >= questions.length) {
      finishInterview();
      return;
    }

    await speakText("Alright, let's move to the next question.");

    setCurrentIndex(currentIndex + 1);
    setTimeout(() => {
      if (isMicOn) startMic();
    }, 500);


  }

  const finishInterview = async () => {
    stopMic()
    setIsMicOn(false)
    try {
      const result = await axios.post(ServerUrl + "/api/interview/finish", { interviewId }, { withCredentials: true })
      onFinish(result.data)
    } catch (error) {
      console.log(error)
    }
  }


  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    if (timeLeft === 0 && !isSubmitting && !feedback) {
      submitAnswer()
    }
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);


  // ---- derived UI state for the dynamic orb avatar ----
  const ringOpacity = isAIPlaying ? 1 : 0.4;
  const waveOpacity = isAIPlaying ? 1 : 0.15;
  const statusText = subtitle
    ? null
    : isAIPlaying
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

  const waveBars = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.5, 0.34, 0.2, 0.08, 0.18, 0.3];

  return (
    <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

      <div className='relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_300px]'>

        {/* ===================== MAIN STAGE ===================== */}
        <div className='relative flex flex-col items-center justify-center gap-8 px-6 py-16 pb-44'>

          {/* question */}
          <div className='text-center px-2 max-w-3xl'>
            <div className='text-xs tracking-[0.28em] uppercase text-zinc-500 font-semibold mb-4'>
              {isIntroPhase ? "Introduction" : `Question ${currentIndex + 1} of ${questions.length}`}
            </div>
            <h2 className='font-extralight tracking-tight leading-snug text-zinc-50'
              style={{ fontSize: 'clamp(22px,2.6vw,34px)' }}>
              {isIntroPhase ? "Let's get you settled in." : currentQuestion?.question}
            </h2>
          </div>

          {/* dynamic AI orb avatar */}
          <div className='relative w-[212px] h-[212px] flex items-center justify-center'>
            {/* spinning conic ring — brightens while speaking */}
            <div className='absolute rounded-full'
              style={{ inset: -26, background: 'conic-gradient(from 0deg, rgba(232,232,232,0.7), rgba(120,118,235,0.4), rgba(160,160,160,0.2), rgba(232,232,232,0.7))', filter: 'blur(12px)', animation: 'spinSlow 6s linear infinite', opacity: ringOpacity, transition: 'opacity .4s' }}></div>
            <div className='absolute rounded-full' style={{ inset: -6, border: '1px solid rgba(255,255,255,0.14)' }}></div>
            {/* sphere */}
            <div className='relative w-[188px] h-[188px] rounded-full flex items-center justify-center'
              style={{ background: 'radial-gradient(circle at 38% 32%, rgba(60,60,72,0.95), rgba(14,14,18,0.98))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 40px rgba(120,118,235,0.18), 0 0 50px rgba(0,0,0,0.6)' }}>
              <div className='w-24 h-24 rounded-full'
                style={{ background: 'radial-gradient(circle at 40% 35%, #e8e8e8, #9a9aa3)', boxShadow: '0 0 30px rgba(200,200,200,0.3)', animation: 'idlePulse 3.2s ease-in-out infinite' }}></div>
            </div>
          </div>

          {/* waveform — active while speaking */}
          <div className='flex items-end gap-1 h-[42px]' style={{ opacity: waveOpacity, transition: 'opacity .4s' }}>
            {waveBars.map((delay, i) => (
              <div key={i} style={{ width: 3, height: '100%', borderRadius: 3, background: 'linear-gradient(180deg,#e8e8e8,#7a7a82)', transformOrigin: 'bottom', animation: `wave 0.9s ease-in-out infinite`, animationDelay: `${delay}s` }}></div>
            ))}
          </div>

          {/* status / subtitle */}
          <div className='min-h-[44px] max-w-xl text-center'>
            {subtitle
              ? <p className='text-sm text-zinc-300 font-light leading-relaxed'>{subtitle}</p>
              : micError
                ? <p className='text-sm font-light leading-relaxed' style={{ color: '#fca5a5' }}>{micError}</p>
                : interimText
                  ? <p className='text-sm text-zinc-300 font-light leading-relaxed italic'>“{interimText}”</p>
                  : <p className='text-sm text-zinc-500 font-light'>{statusText}</p>}
          </div>

          {/* answer + controls (kept from original interview flow).
              The textarea stays mounted for every question — including follow-ups —
              so the typing bar never disappears; only the action row below swaps. */}
          {!isIntroPhase && (
            <div className='w-full max-w-2xl glass rounded-2xl p-5'>
              <textarea
                placeholder="Speak, or type your answer here…"
                onChange={(e) => setAnswer(e.target.value)}
                value={answer}
                rows={3}
                disabled={!!feedback}
                className='w-full bg-white/[0.03] p-4 rounded-xl resize-none outline-none border border-white/10 focus:border-[rgba(192,192,192,0.55)] transition text-zinc-100 text-sm disabled:opacity-60' />

              {!feedback ? (
                <div className='flex items-center gap-3 mt-4'>
                  <motion.button
                    onClick={toggleMic}
                    whileTap={{ scale: 0.9 }}
                    className='w-12 h-12 flex-none flex items-center justify-center rounded-full transition'
                    style={isMicOn
                      ? { background: 'var(--accent-grad)', color: '#0a0a0a', boxShadow: '0 0 24px rgba(200,200,200,0.18)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {isMicOn ? <FaMicrophone size={18} /> : <FaMicrophoneSlash size={18} />}
                  </motion.button>
                  <motion.button
                    onClick={submitAnswer}
                    disabled={isSubmitting}
                    whileTap={{ scale: 0.97 }}
                    className='flex-1 btn-metal py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed'>
                    {isSubmitting ? "Submitting..." : "Submit Answer"}
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className='rounded-xl p-5 mt-4'
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className='text-[11.5px] tracking-[0.04em] text-metal font-semibold mb-2 uppercase'>AI Feedback</p>
                  <p className='text-zinc-300 font-light leading-relaxed mb-4'>{feedback}</p>
                  <button
                    onClick={handleNext}
                    className='w-full btn-metal py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5'>
                    {currentIndex + 1 >= questions.length ? "Finish Interview" : "Next Question"} <BsArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {/* bottom HUD: timer + voice toggle */}
          <div className='absolute bottom-8 left-0 right-0 flex items-center justify-center gap-5'>
            <div className='flex items-center gap-3 px-4 py-2.5 rounded-full glass'>
              {isAIPlaying
                ? <span className='text-xs text-metal font-semibold tracking-wide'>AI Speaking</span>
                : <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} />}
            </div>
            <div className='flex p-1 rounded-full glass text-xs'>
              <button onClick={() => setVoiceGender("female")}
                className={`px-3.5 py-1.5 rounded-full font-medium transition ${voiceGender === "female" ? 'btn-metal' : 'text-zinc-400'}`}>Aria</button>
              <button onClick={() => setVoiceGender("male")}
                className={`px-3.5 py-1.5 rounded-full font-medium transition ${voiceGender === "male" ? 'btn-metal' : 'text-zinc-400'}`}>Guy</button>
            </div>
          </div>
        </div>

        {/* ===================== PROGRESS PANEL ===================== */}
        <aside className='hidden lg:flex flex-col gap-6 border-l border-white/5 px-7 py-16'>
          <div className='text-xs tracking-[0.2em] uppercase text-zinc-500 font-semibold'>Progress</div>
          <div className='flex flex-col gap-4 overflow-y-auto'>
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
