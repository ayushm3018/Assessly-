import React from 'react'
import { motion } from "motion/react"

// metallic / amber / red badge depending on score band
const badge = (v) => {
  if (v >= 8) return 'linear-gradient(135deg,#c0c0c0,#ffffff,#a0a0a0)';
  if (v >= 6) return 'linear-gradient(135deg,#fbbf24,#fcd34d,#f59e0b)';
  return 'linear-gradient(135deg,#f87171,#fca5a5,#ef4444)';
};

/** Per-question score + feedback cards. */
function QuestionBreakdown({ questionWiseScore = [] }) {
  return (
    <div className='mt-12'>
      <div className='text-[13px] tracking-[0.18em] uppercase text-zinc-500 font-semibold mb-5'>Question Breakdown</div>
      <div className='flex flex-col gap-3'>
        {questionWiseScore.map((q, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className='glass rounded-2xl p-5'>
            <div className='flex items-start gap-4'>
              <span className='flex-none w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-[#0a0a0a]'
                style={{ background: badge(q.score ?? 0) }}>{q.score ?? 0}</span>
              <div className='flex-1'>
                <p className='text-[11px] text-zinc-500'>Question {i + 1}</p>
                <p className='font-medium text-zinc-100 text-sm leading-relaxed mt-0.5'>
                  {q.question || "Question not available"}
                </p>
                <p className='text-sm text-zinc-400 font-light leading-relaxed mt-3'>
                  {q.feedback && q.feedback.trim() !== "" ? q.feedback : "No feedback available for this question."}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default QuestionBreakdown
