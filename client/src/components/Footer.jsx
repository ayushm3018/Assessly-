import React from 'react'

function Footer() {
  return (
    <div className='relative z-10 flex justify-center px-4 pb-10 pt-16'>
      <div className='w-full max-w-6xl glass rounded-3xl py-10 px-6 text-center'>
        <div className='flex justify-center items-center gap-2.5 mb-3'>
            <span className='w-2.5 h-2.5 rounded-full' style={{ background:'linear-gradient(135deg,#e8e8e8,#a0a0a0)', boxShadow:'0 0 12px rgba(200,200,200,0.5)' }}></span>
            <h2 className='font-semibold tracking-tight text-zinc-100'>Assessly</h2>
        </div>
        <p className='text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed font-light'>
          AI-powered interview preparation designed to sharpen communication,
          technical depth, and professional confidence.
        </p>
      </div>
    </div>
  )
}

export default Footer
