import React from 'react'
import AnimatedBackground from '../AnimatedBackground'

/**
 * Gaze-calibration screen ("look at the dot"). The camera is live here so the
 * gaze baseline can be captured while the candidate looks at the center dot; the
 * self-view <video> keeps the detection loop fed.
 */
function CalibrationScreen({ rootRef, camVideoRef }) {
  return (
    <div ref={rootRef} className='relative h-screen overflow-hidden flex flex-col items-center justify-center'
      style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground animated={false} />
      <video ref={camVideoRef} autoPlay muted playsInline
        className='absolute bottom-5 right-5 w-40 h-30 rounded-xl object-cover -scale-x-100 border border-white/15 z-10' />
      <div className='relative z-10 flex flex-col items-center gap-8 text-center px-6'>
        <p className='text-sm tracking-[0.28em] uppercase text-zinc-500 font-semibold'>Calibrating</p>
        <div className='relative flex items-center justify-center' style={{ width: 90, height: 90 }}>
          <span className='absolute rounded-full' style={{ width: 90, height: 90, background: 'rgba(120,118,235,0.18)', animation: 'orbBreath 1.6s ease-in-out infinite' }} />
          <span className='rounded-full' style={{ width: 22, height: 22, background: 'var(--accent-grad)', boxShadow: '0 0 24px rgba(150,150,220,0.7)' }} />
        </div>
        <div>
          <p className='text-lg font-light text-zinc-100'>Look directly at the dot</p>
          <p className='text-sm text-zinc-500 font-light mt-2'>Keep your head and eyes still for a moment…</p>
        </div>
      </div>
    </div>
  );
}

export default CalibrationScreen
