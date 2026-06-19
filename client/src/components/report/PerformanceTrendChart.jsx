import React from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

/** Per-question score trend line. */
function PerformanceTrendChart({ questionWiseScore = [] }) {
  const questionScoreData = questionWiseScore.map((score, index) => ({
    name: `Q${index + 1}`,
    score: score.score || 0,
  }));

  return (
    <div className='glass rounded-[20px] p-5 sm:p-7 mt-6'>
      <div className='text-[13px] tracking-[0.18em] uppercase text-zinc-500 font-semibold mb-5'>Performance Trend</div>
      <div className='h-64'>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={questionScoreData}>
            <defs>
              <linearGradient id="silverArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(232,232,232,0.45)" />
                <stop offset="100%" stopColor="rgba(232,232,232,0)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" stroke="#7d7d86" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 10]} stroke="#7d7d86" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f4f4f5' }} />
            <Area type="monotone" dataKey="score" stroke="#e8e8e8" fill="url(#silverArea)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PerformanceTrendChart
