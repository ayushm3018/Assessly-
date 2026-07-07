import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from "axios"
import { ServerUrl } from '../App'
import { FaArrowLeft } from 'react-icons/fa'
import { motion } from "motion/react"
import AnimatedBackground from '../components/AnimatedBackground'

function InterviewHistory() {
    const [interviews, setInterviews] = useState([])
    const navigate = useNavigate()

    useEffect(() => {
        const getMyInterviews = async () => {
            try {
                const result = await axios.get(ServerUrl + "/api/interview/get-interview", { withCredentials: true })
                setInterviews(result.data)
            } catch (error) {
                console.log(error)
            }
        }
        getMyInterviews()
    }, [])

    const badge = (v) => {
        if (v >= 8) return 'linear-gradient(135deg,#c0c0c0,#ffffff,#a0a0a0)';
        if (v >= 6) return 'linear-gradient(135deg,#fbbf24,#fcd34d,#f59e0b)';
        return 'linear-gradient(135deg,#f87171,#fca5a5,#ef4444)';
    };

    const isFinished = (i) => i.status === "completed"
    const isTerminated = (i) => i.status === "terminated"

    // Average/best only consider finished interviews — abandoned runs score 0 and
    // would otherwise drag these stats down misleadingly.
    const completedScores = interviews.filter(isFinished).map((i) => i.finalScore || 0)
    const avg = completedScores.length ? (completedScores.reduce((a, b) => a + b, 0) / completedScores.length).toFixed(1) : "—"
    const best = completedScores.length ? Math.max(...completedScores).toFixed(1) : "—"

    return (
        <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
            <AnimatedBackground />
            <div className='relative z-10 max-w-5xl mx-auto px-5 sm:px-6 py-12'>

                <div className='flex items-start gap-4 mb-10'>
                    <button
                        onClick={() => navigate("/")}
                        className='mt-1 p-3 rounded-full glass hover:border-white/25 transition'><FaArrowLeft className='text-zinc-300' /></button>
                    <div className='flex-1'>
                        <div className='text-xs tracking-[0.3em] uppercase text-zinc-500 font-semibold'>Your History</div>
                        <h1 className='text-4xl font-extralight tracking-tight text-zinc-50 mt-2'>Past interviews</h1>
                    </div>
                    <button onClick={() => navigate("/interview")} className='btn-metal h-[46px] px-6 rounded-xl font-semibold text-sm'>New Interview</button>
                </div>

                {/* stats bar */}
                <div className='grid grid-cols-3 gap-4 mb-8'>
                    <div className='glass rounded-2xl px-5 py-5 flex items-center gap-4'>
                        <div className='text-3xl font-extralight text-zinc-50'>{interviews.length}</div>
                        <div className='text-[13px] text-zinc-500 font-light leading-tight'>Total<br />interviews</div>
                    </div>
                    <div className='glass rounded-2xl px-5 py-5 flex items-center gap-4'>
                        <div className='text-3xl font-extralight text-metal'>{avg}</div>
                        <div className='text-[13px] text-zinc-500 font-light leading-tight'>Average<br />score</div>
                    </div>
                    <div className='glass rounded-2xl px-5 py-5 flex items-center gap-4'>
                        <div className='text-3xl font-extralight text-metal'>{best}</div>
                        <div className='text-[13px] text-zinc-500 font-light leading-tight'>Best<br />score</div>
                    </div>
                </div>

                {interviews.length === 0 ? (
                    <div className='glass p-10 rounded-2xl text-center'>
                        <p className='text-zinc-400 font-light'>No interviews found. Start your first interview.</p>
                    </div>
                ) : (
                    <div className='grid sm:grid-cols-2 gap-4'>
                        {interviews.map((item, index) => (
                            <motion.div key={index}
                                whileHover={{ y: -4 }}
                                onClick={() => navigate(`/report/${item._id}`)}
                                className='glass rounded-[18px] p-6 cursor-pointer transition'
                                style={{ }}>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <h3 className='text-[16.5px] font-medium text-zinc-50 tracking-tight truncate'>{item.role}</h3>
                                        <p className='text-[12.5px] text-zinc-500 mt-1.5 font-light'>
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {isFinished(item) ? (
                                        <span className='flex-none w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-[#0a0a0a]'
                                            style={{ background: badge(item.finalScore || 0) }}>{Number(item.finalScore || 0).toFixed(1)}</span>
                                    ) : isTerminated(item) ? (
                                        <span className='flex-none w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-[#0a0a0a]'
                                            style={{ background: 'linear-gradient(135deg,#f87171,#fca5a5,#ef4444)' }}>0.0</span>
                                    ) : (
                                        <span className='flex-none w-11 h-11 rounded-xl flex items-center justify-center text-lg font-light text-zinc-500 bg-white/[0.04] border border-white/10'>—</span>
                                    )}
                                </div>
                                <div className='flex flex-wrap items-center gap-2 mt-5'>
                                    <span className='flex-none text-[11.5px] px-3 py-1.5 rounded-full font-medium'
                                        style={item.mode === "Technical"
                                            ? { background: 'rgba(120,118,235,0.12)', border: '1px solid rgba(120,118,235,0.35)', color: '#a5a3f0' }
                                            : { background: 'rgba(192,192,192,0.08)', border: '1px solid rgba(192,192,192,0.25)', color: '#d4d4d8' }}>
                                        {item.mode}
                                    </span>
                                    {item.experience && (
                                        <span className='max-w-[160px] truncate text-[11.5px] px-3 py-1.5 rounded-full font-light text-zinc-400 bg-white/[0.04] border border-white/10'
                                            title={item.experience}>
                                            {item.experience}
                                        </span>
                                    )}
                                    {(() => {
                                        const s = isFinished(item)
                                            ? { color: 'text-emerald-300', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'Completed' }
                                            : isTerminated(item)
                                                ? { color: 'text-red-300', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.35)', label: 'Terminated' }
                                                : { color: 'text-amber-300', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Not finished' };
                                        return (
                                            <span className={`flex-none text-[11.5px] px-3 py-1.5 rounded-full font-medium ${s.color}`}
                                                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                                                {s.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default InterviewHistory
