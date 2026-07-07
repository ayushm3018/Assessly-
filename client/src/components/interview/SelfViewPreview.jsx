import React from 'react'
import { FaVideo } from 'react-icons/fa'

/**
 * Small fixed corner webcam tile during the interview — transparency that the
 * candidate is monitored, and helps them stay framed.
 *
 * @param camVideoRef ref bound to the camera stream
 * @param camStatus   camera/model status ('ready' once monitoring)
 */
function SelfViewPreview({ camVideoRef, camStatus }) {
  return (
    <div className='absolute bottom-5 right-5 z-40 rounded-xl overflow-hidden border border-white/15 shadow-lg'
      style={{ width: 160, height: 120, background: '#000' }}>
      <video ref={camVideoRef} autoPlay muted playsInline
        className='w-full h-full object-cover -scale-x-100' />
      <div className='absolute bottom-1 left-1.5 flex items-center gap-1.5 text-[10px] text-zinc-200 font-medium'>
        <FaVideo size={10} style={{ color: camStatus === 'ready' ? '#34d399' : '#f59e0b' }} />
        {camStatus === 'ready' ? 'Monitoring' : 'Camera…'}
      </div>
    </div>
  );
}

export default SelfViewPreview
