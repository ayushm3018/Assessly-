import React from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
function Timer({ timeLeft, totalTime }) {
    const percentage = (timeLeft / totalTime) * 100
    const low = timeLeft <= 10
  return (
    <div className='w-14 h-14'>
        <CircularProgressbar
        value={percentage}
        text={`${timeLeft}s`}
        styles={buildStyles({
          textSize: "28px",
          pathColor: low ? "#f87171" : "#e8e8e8",
          textColor: low ? "#f87171" : "#f4f4f5",
          trailColor: "rgba(255,255,255,0.08)",
        })}
        />

    </div>
  )
}

export default Timer
