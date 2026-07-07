import React from 'react'
import { motion } from "motion/react"
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa"
import { BsArrowRight } from 'react-icons/bs'
import Timer from '../Timer'
import InterviewOrb from './InterviewOrb'

/**
 * Main interview stage: the question header, the reactive orb, the status / live
 * transcription line, the timer, and the answer box with mic + submit controls.
 * Purely presentational — all state and handlers come from the orchestrator.
 */
function InterviewStage({
  orbRef,
  isSpeakingRef,
  isAIPlaying,
  isIntroPhase,
  currentIndex,
  questionsLength,
  currentQuestion,
  subtitle,
  micError,
  interimText,
  isMicOn,
  timeLeft,
  answer,
  setAnswer,
  toggleMic,
  submitAnswer,
  isSubmitting,
  isLast,
}) {
  const statusText = isAIPlaying
    ? "AI interviewer is speaking"
    : isMicOn
      ? "Listening to your answer…"
      : "Microphone muted";

  return (
    <div className='relative flex flex-col items-center justify-center gap-4 px-6 py-6 overflow-hidden'>

      {/* question */}
      <div className='text-center max-w-3xl'>
        <div className='text-[11px] tracking-[0.28em] uppercase text-zinc-500 font-semibold mb-3'>
          {isIntroPhase ? "Introduction" : `Question ${currentIndex + 1} of ${questionsLength}`}
        </div>
        <h2 className='font-extralight tracking-tight leading-snug text-zinc-50'
          style={{ fontSize: 'clamp(20px,2.3vw,30px)' }}>
          {isIntroPhase ? "Let's get you settled in." : currentQuestion?.question}
        </h2>
      </div>

      {/* reactive Siri-style glowing orb */}
      <InterviewOrb ref={orbRef} isSpeakingRef={isSpeakingRef} />

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
  );
}

export default InterviewStage
