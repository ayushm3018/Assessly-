import React, { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AnimatedBackground from '../components/AnimatedBackground'
import AuthModel from '../components/AuthModel'
import { useSelector } from 'react-redux'
import { motion } from "motion/react"
import { useNavigate } from 'react-router-dom'
import {
  BsRobot,
  BsMic,
  BsBarChart,
  BsFileEarmarkText,
  BsArrowRepeat,
  BsDownload,
} from "react-icons/bs"

// Each feature now gets its own full-height section revealed on scroll,
// replacing the old auto-scrolling marquee of cards.
const FEATURES = [
  {
    icon: <BsRobot />,
    kicker: "Adaptive",
    title: "Questions that scale with you.",
    desc: "Difficulty recalibrates live with every answer — from warm-up to senior-level depth, tuned to your role and experience.",
  },
  {
    icon: <BsMic />,
    kicker: "Neural Voice",
    title: "Speak naturally. It listens.",
    desc: "A neural-voice interviewer asks, hears, and reasons in real time — practice out loud, the way the real thing feels.",
  },
  {
    icon: <BsArrowRepeat />,
    kicker: "Cross-Questioning",
    title: "It digs deeper, like a real panel.",
    desc: "Vague claims get probed. Strong answers get challenged. The interviewer follows up on what you actually said.",
  },
  {
    icon: <BsBarChart />,
    kicker: "Deep Analytics",
    title: "Scored on what matters.",
    desc: "Confidence, communication, and correctness — measured per question, with honest feedback you can act on.",
  },
  {
    icon: <BsFileEarmarkText />,
    kicker: "Resume-Aware",
    title: "Grounded in your résumé.",
    desc: "Upload your résumé and the questions reference your real projects and skills — no generic filler.",
  },
  {
    icon: <BsDownload />,
    kicker: "Reports",
    title: "Take the insight with you.",
    desc: "Every session distills into a downloadable report — strengths, gaps, and a clear path to your next round.",
  },
]

function FeatureSection({ feature, index }) {
  const flip = index % 2 === 1
  return (
    <section className='relative flex items-center justify-center px-6 py-16 md:py-20'>
      <div className={`max-w-6xl w-full grid md:grid-cols-2 gap-10 md:gap-20 items-center ${flip ? 'md:[direction:rtl]' : ''}`}>
        {/* copy */}
        <motion.div
          className='md:[direction:ltr]'
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
          <div className='text-xs tracking-[0.32em] uppercase text-metal font-semibold mb-5'>{feature.kicker}</div>
          <h2 className='text-4xl md:text-5xl font-extralight tracking-tight leading-[1.05] text-zinc-50 max-w-[14ch]'>
            {feature.title}
          </h2>
          <p className='mt-7 text-zinc-400 font-light text-lg leading-relaxed max-w-[46ch]'>
            {feature.desc}
          </p>
        </motion.div>

        {/* visual */}
        <motion.div
          className='md:[direction:ltr] flex justify-center'
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}>
          <div className='relative w-[min(380px,80vw)] aspect-square glass rounded-[32px] flex items-center justify-center'
            style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4)' }}>
            <div className='absolute top-0 left-10 right-10 h-px' style={{ background: 'linear-gradient(90deg,transparent,rgba(232,232,232,0.6),transparent)' }}></div>
            <div className='absolute inset-0 rounded-[32px]' style={{ background: 'radial-gradient(circle at 50% 35%, rgba(132,122,236,0.16), transparent 60%)' }}></div>
            <div className='relative w-28 h-28 rounded-3xl glass flex items-center justify-center text-5xl text-zinc-200'
              style={{ animation: 'floaty 6s ease-in-out infinite' }}>
              {feature.icon}
            </div>
            <div className='absolute bottom-8 left-0 right-0 text-center text-[11px] tracking-[0.3em] uppercase text-zinc-600 font-medium'>
              {String(index + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Home() {
  const { userData } = useSelector((state) => state.user)
  const [showAuth, setShowAuth] = useState(false)
  const navigate = useNavigate()

  // Login is required before starting an interview: gate the CTA behind auth.
  const goInterview = () => {
    if (!userData) { setShowAuth(true); return }
    navigate("/interview")
  }
  const goHistory = () => {
    if (!userData) { setShowAuth(true); return }
    navigate("/history")
  }

  return (
    <div className='relative min-h-screen overflow-x-hidden' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

      <div className='relative z-10'>
        <Navbar />

        {/* ===================== HERO ===================== */}
        <section className='min-h-[92vh] flex flex-col items-center justify-center text-center px-6'>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className='text-xs tracking-[0.32em] uppercase text-metal font-semibold mb-7'>
            AI-Powered Interview Training
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05 }}
            className='font-extralight tracking-tight leading-[1.02] text-zinc-50'
            style={{ fontSize: 'clamp(46px,7vw,78px)', maxWidth: '14ch' }}>
            Ace Every Interview.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12 }}
            className='mt-7 text-lg font-light leading-relaxed text-zinc-400'
            style={{ maxWidth: '54ch' }}>
            Practice with an AI interviewer that adapts to your level, cross-questions
            your answers, and gives real, scored feedback.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18 }}
            className='mt-10 flex flex-wrap items-center justify-center gap-4'>
            <button
              onClick={goInterview}
              className='relative overflow-hidden h-[52px] px-9 rounded-[28px] btn-metal font-semibold text-base'>
              Start Practicing
              <span className='absolute top-0 bottom-0 w-1/3 pointer-events-none'
                style={{ background: 'linear-gradient(120deg,transparent,rgba(255,255,255,0.85),transparent)', animation: 'shimmer 4.5s ease-in-out infinite' }}></span>
            </button>
            <button
              onClick={goHistory}
              className='h-[52px] px-9 rounded-[28px] bg-transparent text-zinc-100 font-medium border border-[rgba(192,192,192,0.4)] hover:border-[rgba(232,232,232,0.7)] transition'>
              View History
            </button>
          </motion.div>

          {/* scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className='absolute bottom-10 flex flex-col items-center gap-2 text-zinc-600'>
            <span className='text-[11px] tracking-[0.3em] uppercase'>Scroll</span>
            <span className='w-px h-10' style={{ background: 'linear-gradient(180deg,rgba(200,200,200,0.5),transparent)' }}></span>
          </motion.div>
        </section>

        {/* ===================== FEATURE SECTIONS ===================== */}
        {FEATURES.map((f, i) => (
          <FeatureSection key={i} feature={f} index={i} />
        ))}

        {/* ===================== CLOSING CTA ===================== */}
        <section className='relative min-h-[70vh] flex flex-col items-center justify-center text-center px-6'>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7 }}
            className='font-extralight tracking-tight text-zinc-50'
            style={{ fontSize: 'clamp(36px,5vw,60px)', maxWidth: '18ch' }}>
            Your next interview starts here.
          </motion.h2>
          <motion.button
            onClick={goInterview}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className='relative overflow-hidden mt-10 h-[52px] px-9 rounded-[28px] btn-metal font-semibold text-base'>
            Start Practicing
            <span className='absolute top-0 bottom-0 w-1/3 pointer-events-none'
              style={{ background: 'linear-gradient(120deg,transparent,rgba(255,255,255,0.85),transparent)', animation: 'shimmer 4.5s ease-in-out infinite' }}></span>
          </motion.button>
        </section>

        <Footer />
      </div>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
    </div>
  )
}

export default Home
