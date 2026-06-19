import React from 'react'

/**
 * Hero score block. A terminated run is void: force a "0.0" red score and hide
 * the performance copy.
 */
function ScoreHero({ isTerminated, finalScore = 0 }) {
  let performanceText = "";
  let shortTagline = "";

  if (finalScore >= 8) {
    performanceText = "Ready for job opportunities.";
    shortTagline = "Excellent clarity and structured responses.";
  } else if (finalScore >= 5) {
    performanceText = "Needs minor improvement before interviews.";
    shortTagline = "Good foundation, refine articulation.";
  } else {
    performanceText = "Significant improvement required.";
    shortTagline = "Work on clarity and confidence.";
  }

  return (
    <div className='text-center'>
      <div className='text-xs tracking-[0.3em] uppercase text-zinc-500 font-semibold'>
        {isTerminated ? "Session Terminated" : "Session Complete"}
      </div>
      <div className={`font-extralight leading-none mt-4 ${isTerminated ? '' : 'text-metal'}`}
        style={{ fontSize: 'clamp(96px,15vw,168px)', filter: 'drop-shadow(0 0 40px rgba(200,200,200,0.2))', color: isTerminated ? '#f87171' : undefined }}>
        {isTerminated ? "0.0" : Number(finalScore || 0).toFixed(1)}
      </div>
      <div className='text-zinc-400 font-light tracking-wide'>Overall Score · out of 10</div>
      {!isTerminated && (
        <div className='mt-4'>
          <p className='font-medium text-zinc-100'>{performanceText}</p>
          <p className='text-zinc-500 text-sm mt-1 font-light'>{shortTagline}</p>
        </div>
      )}
    </div>
  );
}

export default ScoreHero
