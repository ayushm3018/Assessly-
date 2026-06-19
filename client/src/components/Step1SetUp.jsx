import React from 'react'
import { motion } from "motion/react"
import { useState } from 'react';
import axios from "axios"
import { ServerUrl } from '../App';
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import AnimatedBackground from './AnimatedBackground';
import LoadingOverlay from './LoadingOverlay';

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
    "Questions built from your real résumé — your projects and skills.",
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
    const [busy, setBusy] = useState(false);
    const [stage, setStage] = useState("");
    const [error, setError] = useState("");

    // Single flow: analyze the (required) résumé, then generate the interview.
    // A loading bar covers both steps; there's no separate "Analyze" button.
    const handleBegin = async () => {
        if (busy) return;
        setError("");

        if (!resumeFile) {
            setError("Please upload your résumé (PDF) — the interview is based on it.");
            return;
        }

        setBusy(true);
        try {
            // 1) Analyze résumé
            setStage("Analyzing your résumé…");
            const formdata = new FormData();
            formdata.append("resume", resumeFile);

            let analysis;
            try {
                const res = await axios.post(ServerUrl + "/api/interview/resume", formdata, { withCredentials: true });
                analysis = res.data;
            } catch (err) {
                // 422 = not a resume; surface that message specifically.
                setError(err.response?.data?.message || "Failed to read your résumé. Please try another PDF.");
                setBusy(false);
                return;
            }

            const resumeText = analysis.resumeText || "";
            const projects = analysis.projects || [];
            const skills = analysis.skills || [];
            const finalRole = (role || analysis.role || "").trim();
            const finalExp = experience || normalizeExperience(analysis.experience) || "Fresher";

            if (!finalRole) {
                setError("Couldn't determine a role from your résumé. Please type the role you're interviewing for.");
                setBusy(false);
                return;
            }

            // 2) Generate the interview from the résumé
            setStage("Preparing your interview…");
            const result = await axios.post(
                ServerUrl + "/api/interview/generate-questions",
                { role: finalRole, experience: finalExp, mode, resumeText, projects, skills },
                { withCredentials: true }
            );

            if (userData) {
                dispatch(setUserData({ ...userData, credits: result.data.creditsLeft }));
            }
            onStart(result.data);
        } catch (error) {
            console.log(error);
            setError(error.response?.data?.message || "Something went wrong. Please try again.");
            setBusy(false);
        }
    };

    const inputBase = 'mt-2.5 w-full h-[46px] px-4 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-100 text-sm outline-none transition focus:border-[rgba(192,192,192,0.55)] disabled:opacity-50'
    const pill = (active) => `flex-1 h-10 rounded-[10px] text-sm font-medium transition ${active ? 'btn-metal' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`

    return (
        <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
            {busy && <LoadingOverlay stage={stage} />}
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
                        <div className='text-[13.5px] text-zinc-400 mt-1.5 font-light'>Upload your résumé — your interview is built from it.</div>

                        {error && (
                            <div className='mt-5 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2.5'
                                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                                <span className='flex-none w-1.5 h-1.5 rounded-full' style={{ background: '#f87171' }}></span>
                                {error}
                            </div>
                        )}

                        {/* resume upload (required) */}
                        <div className='mt-6'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Résumé <span className='text-metal'>* required</span></label>
                            <motion.div
                                whileHover={!busy ? { scale: 1.01 } : {}}
                                onClick={() => !busy && document.getElementById("resumeUpload").click()}
                                className='mt-2.5 min-h-[88px] flex flex-col items-center justify-center p-5 rounded-[13px] cursor-pointer transition text-center'
                                style={{ border: `1px dashed ${resumeFile ? 'rgba(192,192,192,0.6)' : 'rgba(192,192,192,0.3)'}`, background: 'rgba(255,255,255,0.02)', opacity: busy ? 0.6 : 1 }}>
                                <input type="file" accept="application/pdf" id="resumeUpload" className='hidden' disabled={busy}
                                    onChange={(e) => { setResumeFile(e.target.files[0]); setError(""); }} />
                                <div className='text-sm text-zinc-200'>{resumeFile ? resumeFile.name : "Drop your résumé here"}</div>
                                <div className='text-[13px] text-zinc-500 font-light mt-0.5'>{resumeFile ? "Tap to choose a different file" : "PDF · click to browse"}</div>
                            </motion.div>
                        </div>

                        {/* role (optional — auto-filled from résumé) */}
                        <div className='mt-4'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Role <span className='text-zinc-600'>(optional — auto-filled from résumé)</span></label>
                            <input type='text' placeholder='e.g. Frontend Engineer'
                                className={inputBase} disabled={busy}
                                onChange={(e) => setRole(e.target.value)} value={role} />
                        </div>

                        {/* experience (optional — auto-filled) */}
                        <div className='mt-4'>
                            <label className='text-[12.5px] text-zinc-400 font-medium tracking-wide'>Experience <span className='text-zinc-600'>(optional)</span></label>
                            <div className='relative'>
                                <select
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value)}
                                    disabled={busy}
                                    className={inputBase + ' appearance-none cursor-pointer pr-10'}>
                                    <option value="" style={{ background: '#141414' }}>Auto from résumé</option>
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
                                <button onClick={() => !busy && setMode("Technical")} className={pill(mode === "Technical")}>Technical</button>
                                <button onClick={() => !busy && setMode("HR")} className={pill(mode === "HR")}>HR</button>
                            </div>
                        </div>

                        <button
                            onClick={handleBegin}
                            disabled={!resumeFile || busy}
                            className='relative overflow-hidden mt-6 w-full h-[50px] rounded-[14px] btn-metal font-semibold text-[15.5px] disabled:opacity-40 disabled:cursor-not-allowed'>
                            {busy ? "Please wait…" : "Begin Interview"}
                            {!busy && resumeFile && (
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
