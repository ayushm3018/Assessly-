import React from 'react'
import { motion } from "motion/react"
import { useState } from 'react';
import axios from "axios"
import { ServerUrl } from '../App';
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import AnimatedBackground from './AnimatedBackground';

// Fixed experience bands. Keeping this structured (instead of free text) means the
// value is always something the backend can map to a difficulty plan.
const EXPERIENCE_OPTIONS = ["Fresher", "1-2 years", "3-5 years", "6+ years"];

// Resume analysis returns experience as free text ("around 3 years"). Map it to
// the nearest band so the dropdown shows a valid selection.
const normalizeExperience = (raw) => {
    if (!raw) return "";
    if (/fresher|intern|entry|student/i.test(raw)) return "Fresher";
    const match = String(raw).match(/\d+/);
    const years = match ? parseInt(match[0], 10) : 0;
    if (years === 0) return "Fresher";
    if (years <= 2) return "1-2 years";
    if (years <= 5) return "3-5 years";
    return "6+ years";
};

const BULLETS = [
    "Tailored question sets for any role and seniority.",
    "Real-time follow-ups that probe your reasoning.",
    "A scored report the moment you finish.",
];

function Step1SetUp({ onStart }) {
    const { userData } = useSelector((state) => state.user)
    const dispatch = useDispatch()
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [mode, setMode] = useState("Technical");
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [skills, setSkills] = useState([]);
    const [resumeText, setResumeText] = useState("");
    const [analysisDone, setAnalysisDone] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");

    const handleUploadResume = async () => {
        if (!resumeFile || analyzing) return;
        setAnalyzing(true)
        setError("")

        const formdata = new FormData()
        formdata.append("resume", resumeFile)

        try {
            const result = await axios.post(ServerUrl + "/api/interview/resume", formdata, { withCredentials: true })

            setRole(result.data.role || "");
            setExperience(normalizeExperience(result.data.experience));
            setProjects(result.data.projects || []);
            setSkills(result.data.skills || []);
            setResumeText(result.data.resumeText || "");
            setAnalysisDone(true);
            setAnalyzing(false);
        } catch (error) {
            console.log(error)
            setError(error.response?.data?.message || "Failed to analyze resume. Please try again.")
            setAnalyzing(false);
        }
    }

    const handleStart = async () => {
        setLoading(true)
        setError("")
        try {
            const result = await axios.post(ServerUrl + "/api/interview/generate-questions", { role, experience, mode, resumeText, projects, skills }, { withCredentials: true })
            if (userData) {
                dispatch(setUserData({ ...userData, credits: result.data.creditsLeft }))
            }
            setLoading(false)
            onStart(result.data)
        } catch (error) {
            console.log(error)
            // Surface the real reason (e.g. "Not enough credits") instead of failing silently.
            setError(error.response?.data?.message || "Something went wrong. Please try again.")
            setLoading(false)
        }
    }

    const inputBase = 'mt-2.5 w-full h-[46px] px-4 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-100 text-sm outline-none transition focus:border-[rgba(192,192,192,0.55)]'
    const pill = (active) => `flex-1 h-10 rounded-[10px] text-sm font-medium transition ${active ? 'btn-metal' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`

    return (
        <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
            <AnimatedBackground />
            <div className='relative z-10 min-h-screen grid md:grid-cols-[1.05fr_1fr]'>

                {/* left panel */}
                <motion.div
                    initial={{ x: -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className='relative hidden md:flex flex-col justify-center px-[5vw] py-[8vh] overflow-hidden border-r border-white/5'>
                    <div className='absolute' style={{ top: '18%', left: '8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(120,118,235,0.5), rgba(79,70,229,0.18) 45%, transparent 70%)', filter: 'blur(20px)', animation: 'orbDrift 12s ease-in-out infinite' }}></div>
                    <div className='absolute' style={{ bottom: '14%', right: '10%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(200,200,200,0.16), transparent 68%)', filter: 'blur(18px)', animation: 'orbDrift 15s ease-in-out infinite' }}></div>

                    <div className='relative'>
                        <div className='text-xs tracking-[0.3em] uppercase text-zinc-500 font-semibold mb-5'>Step 01 / Configure</div>
                        <h2 className='text-5xl font-extralight tracking-tight leading-[1.05] text-zinc-50'>Ready to<br />practice?</h2>
                        <div className='mt-10 flex flex-col gap-5 max-w-[380px]'>
                            {BULLETS.map((b, i) => (
                                <div key={i} className='flex gap-3.5 items-start'>
                                    <span className='flex-none mt-0.5 w-[22px] h-[22px] rounded-full border border-[rgba(220,220,220,0.5)] flex items-center justify-center'>
                                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.7 9.5 3.5" stroke="#e8e8e8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </span>
                                    <span className='text-[15px] text-zinc-300 font-light leading-relaxed'>{b}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* right form */}
                <motion.div
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.7 }}
                    className='flex items-center justify-center px-6 py-[8vh]'>
                    <div className='w-full max-w-[440px] glass rounded-[22px] p-9' style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4)' }}>
                        <div className='text-[22px] font-medium tracking-tight text-zinc-50'>Interview setup</div>
                        <div className='text-[13.5px] text-zinc-400 mt-1.5 font-light'>Configure your session in under a minute.</div>

                        {error && (
                            <div className='mt-5 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2.5'
                                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                                <span className='flex-none w-1.5 h-1.5 rounded-full' style={{ background: '#f87171' }}></span>
                                {error}
                            </div>
                        )}

                        {/* role */}
                        <div className='mt-6'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Role</label>
                            <input type='text' placeholder='e.g. Senior Frontend Engineer'
                                className={inputBase}
                                onChange={(e) => setRole(e.target.value)} value={role} />
                        </div>

                        {/* experience */}
                        <div className='mt-4'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Experience</label>
                            <div className='relative'>
                                <select
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    className={inputBase + ' appearance-none cursor-pointer pr-10'}>
                                    <option value="" style={{ background: '#141414' }}>Select experience</option>
                                    {EXPERIENCE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} style={{ background: '#141414' }}>{opt}</option>
                                    ))}
                                </select>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none'><path d="M2.5 4.5 6 8l3.5-3.5" stroke="#9a9aa3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                        </div>

                        {/* mode toggle */}
                        <div className='mt-4'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Interview mode</label>
                            <div className='mt-2.5 flex p-1 rounded-[13px] bg-white/[0.03] border border-white/10'>
                                <button onClick={() => setMode("Technical")} className={pill(mode === "Technical")}>Technical</button>
                                <button onClick={() => setMode("HR")} className={pill(mode === "HR")}>HR</button>
                            </div>
                        </div>

                        {/* resume upload */}
                        {!analysisDone && (
                            <div className='mt-4'>
                                <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Resume <span className='text-zinc-600'>(optional)</span></label>
                                <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => document.getElementById("resumeUpload").click()}
                                    className='mt-2.5 min-h-[78px] flex flex-col items-center justify-center p-4 rounded-[13px] cursor-pointer transition'
                                    style={{ border: `1px dashed ${resumeFile ? 'rgba(192,192,192,0.6)' : 'rgba(192,192,192,0.3)'}`, background: 'rgba(255,255,255,0.02)' }}>
                                    <input type="file" accept="application/pdf" id="resumeUpload" className='hidden'
                                        onChange={(e) => setResumeFile(e.target.files[0])} />
                                    <div className='text-center text-[13px] text-zinc-400 font-light'>
                                        <div className='text-sm text-zinc-200 mb-0.5'>{resumeFile ? resumeFile.name : "Drop your résumé here"}</div>
                                        {resumeFile ? "Ready to analyze" : "PDF · click to browse"}
                                    </div>
                                    {resumeFile && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleUploadResume() }}
                                            className='mt-3 px-5 py-2 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/10 text-zinc-200 hover:border-white/25 transition'>
                                            {analyzing ? "Analyzing..." : "Analyze Resume"}
                                        </button>
                                    )}
                                </motion.div>
                            </div>
                        )}

                        {analysisDone && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className='mt-4 glass rounded-xl p-5 space-y-4'>
                                <h3 className='text-sm font-semibold text-zinc-100'>Résumé analysis</h3>
                                {projects.length > 0 && (
                                    <div>
                                        <p className='text-[13px] font-medium text-zinc-400 mb-1.5'>Projects</p>
                                        <ul className='list-disc list-inside text-zinc-400 text-sm space-y-1 font-light'>
                                            {projects.map((p, i) => (<li key={i}>{p}</li>))}
                                        </ul>
                                    </div>
                                )}
                                {skills.length > 0 && (
                                    <div>
                                        <p className='text-[13px] font-medium text-zinc-400 mb-1.5'>Skills</p>
                                        <div className='flex flex-wrap gap-2'>
                                            {skills.map((s, i) => (
                                                <span key={i} className='px-3 py-1 rounded-full text-xs text-zinc-300 bg-white/[0.05] border border-white/10'>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        <button
                            onClick={handleStart}
                            disabled={!role || !experience || loading}
                            className='relative overflow-hidden mt-6 w-full h-[50px] rounded-[14px] btn-metal font-semibold text-[15.5px] disabled:opacity-40 disabled:cursor-not-allowed'>
                            {loading ? "Starting..." : "Start Interview"}
                            {!loading && !(!role || !experience) && (
                                <span className='absolute top-0 bottom-0 w-1/3 pointer-events-none'
                                    style={{ background: 'linear-gradient(120deg,transparent,rgba(255,255,255,0.85),transparent)', animation: 'shimmer 4.5s ease-in-out infinite' }}></span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

export default Step1SetUp
