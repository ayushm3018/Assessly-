import React from 'react'
import { REASON_PHRASES } from '../../utils/proctoring'

/**
 * Red banner shown when an interview was terminated for proctoring violations.
 * Lists the detected reasons when the server provides them.
 *
 * @param reasons string[] of violation reason codes (report.violationReasons)
 */
function TerminatedBanner({ reasons = [] }) {
  const terminationReasons = reasons
    .map((r) => REASON_PHRASES[r] || r)
    .join(", ");

  return (
    <div className='mb-8 rounded-2xl px-6 py-5 flex items-start gap-4 border'
      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' }}>
      <span className='flex-none w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold'
        style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>!</span>
      <div>
        <p className='font-semibold text-red-300'>Interview Terminated</p>
        <p className='text-sm text-zinc-400 font-light mt-1 leading-relaxed'>
          This interview was terminated after 3 proctoring violations. The score has been recorded as 0.
        </p>
        {terminationReasons && (
          <p className='text-sm text-zinc-300 font-light mt-2 leading-relaxed'>
            <span className='text-zinc-500'>Detected:</span> {terminationReasons}.
          </p>
        )}
      </div>
    </div>
  );
}

export default TerminatedBanner
