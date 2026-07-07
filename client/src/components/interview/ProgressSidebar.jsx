import React from 'react'

// Dot styling per progress state (done / current / follow-up / upcoming).
const dotStyle = (state) => {
  if (state === "done") return { background: 'linear-gradient(135deg,#e8e8e8,#a0a0a0)', border: '1px solid transparent', boxShadow: 'none', color: '#c8c8cf' };
  if (state === "current") return { background: 'linear-gradient(135deg,#e8e8e8,#a0a0a0)', border: '1px solid transparent', boxShadow: '0 0 10px rgba(200,200,200,0.6)', color: '#fafafa' };
  if (state === "followup") return { background: '#f59e0b', border: '1px solid transparent', boxShadow: '0 0 10px rgba(245,158,11,0.5)', color: '#fbbf24' };
  return { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'none', color: '#7d7d86' };
};

/**
 * Progress panel. Derives each question's state from the live (possibly
 * follow-up-grown) questions array and the current index.
 */
function ProgressSidebar({ questions, currentIndex }) {
  const progress = questions.map((q, i) => {
    let state = "upcoming";
    if (q.isFollowUp) state = i < currentIndex ? "done" : i === currentIndex ? "current" : "followup";
    else if (i < currentIndex) state = "done";
    else if (i === currentIndex) state = "current";
    return { ...q, state, i };
  });

  return (
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
  );
}

export default ProgressSidebar
