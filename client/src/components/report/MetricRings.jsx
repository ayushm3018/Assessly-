import React from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'

const ring = (value, label) => (
  <div className='flex flex-col items-center glass rounded-[20px] p-7'>
    <div className='w-28 h-28'>
      <CircularProgressbar
        value={value * 10}
        text={`${value}`}
        styles={buildStyles({
          textSize: "22px",
          pathColor: "#e8e8e8",
          textColor: "#fafafa",
          trailColor: "rgba(255,255,255,0.07)",
        })}
      />
    </div>
    <div className='mt-3.5 text-sm text-zinc-300'>{label}</div>
  </div>
);

/** The three skill rings: confidence, communication, correctness. */
function MetricRings({ confidence = 0, communication = 0, correctness = 0 }) {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-5 mt-16'>
      {ring(confidence, "Confidence")}
      {ring(communication, "Communication")}
      {ring(correctness, "Correctness")}
    </div>
  );
}

export default MetricRings
