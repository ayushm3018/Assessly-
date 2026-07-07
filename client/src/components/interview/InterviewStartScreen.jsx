import React from 'react'
import { BsArrowRight } from 'react-icons/bs'
import { FaExpand } from 'react-icons/fa'
import AnimatedBackground from '../AnimatedBackground'

const RULES = [
  "Leaving fullscreen, switching tabs, or switching apps is recorded.",
  "Your camera is checked for a phone, another person, or you leaving / looking away.",
  "You get 3 warnings total — each violation counts as one.",
  "On the 3rd violation the interview ends automatically with a score of 0.",
];

/**
 * Pre-start gate. Clicking "Start" provides the user gesture that fullscreen +
 * audio require, and sets expectations about the proctoring rules.
 */
function InterviewStartScreen({ rootRef, camError, isStarting, onStart }) {
  return (
    <div ref={rootRef} className='relative h-screen overflow-hidden flex items-center justify-center px-6'
      style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground animated={false} />
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
          {RULES.map((rule, i) => (
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

        <button onClick={onStart} disabled={isStarting}
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

export default InterviewStartScreen
