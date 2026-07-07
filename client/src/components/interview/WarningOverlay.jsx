import React from 'react'
import { FaExpand, FaExclamationTriangle } from 'react-icons/fa'

/**
 * Blocking warning overlay for tab/fullscreen/window violations — pauses the
 * interview until the candidate returns and resumes.
 *
 * @param warning      { count, left, reason }
 * @param isFullscreen whether we're currently in fullscreen
 * @param onResume     dismiss + resume (re-enters fullscreen if needed)
 */
function WarningOverlay({ warning, isFullscreen, onResume }) {
  return (
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
        <button onClick={onResume}
          className='btn-metal w-full mt-7 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2'>
          {isFullscreen ? "Resume interview" : <><FaExpand size={15} /> Return to fullscreen</>}
        </button>
      </div>
    </div>
  );
}

export default WarningOverlay
