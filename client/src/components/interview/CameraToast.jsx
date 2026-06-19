import React from 'react'
import { FaExclamationTriangle } from 'react-icons/fa'
import { REASON_LABELS } from '../../utils/proctoring'

/**
 * Non-blocking amber pill shown for a camera detection. The interview keeps
 * running; the toast auto-dismisses (the timer lives in useInterviewProctoring).
 *
 * @param toast { count, left, reason }
 */
function CameraToast({ toast }) {
  return (
    <div className='absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl glass border'
      style={{ borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(20,16,8,0.92)' }}>
      <FaExclamationTriangle style={{ color: '#fbbf24' }} size={18} />
      <div className='text-left'>
        <div className='text-sm font-semibold text-amber-300'>
          Warning {toast.count} of 3 — {REASON_LABELS[toast.reason] || "Suspicious activity"}
        </div>
        <div className='text-[12px] text-zinc-400 font-light'>
          {toast.left === 1
            ? "One more violation ends the interview with a score of 0."
            : `${toast.left} warnings left.`}
        </div>
      </div>
    </div>
  );
}

export default CameraToast
