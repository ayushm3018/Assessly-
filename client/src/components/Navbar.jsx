import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from "motion/react"
import { BsCoin } from "react-icons/bs";
import { HiOutlineLogout } from "react-icons/hi";
import { FaUserAstronaut } from "react-icons/fa";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ServerUrl } from '../App';
import { setUserData } from '../redux/userSlice';
import AuthModel from './AuthModel';
function Navbar() {
    const {userData} = useSelector((state)=>state.user)
    const [showCreditPopup,setShowCreditPopup] = useState(false)
    const [showUserPopup,setShowUserPopup] = useState(false)
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [showAuth, setShowAuth] = useState(false);

    const handleLogout = async () => {
        try {
            await axios.get(ServerUrl + "/api/auth/logout" , {withCredentials:true})
            dispatch(setUserData(null))
            setShowCreditPopup(false)
            setShowUserPopup(false)
            navigate("/")

        } catch (error) {
            console.log(error)
        }
    }
  return (
    <div className='sticky top-0 z-40 flex justify-center px-4 pt-5'>
        <motion.div
        initial={{opacity:0 , y:-40}}
        animate={{opacity:1 , y:0}}
        transition={{duration: 0.4}}
        className='w-full max-w-6xl glass rounded-full px-6 sm:px-8 py-3.5 flex justify-between items-center relative'
        style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
            <div onClick={()=>navigate("/")} className='flex items-center gap-2.5 cursor-pointer'>
                <span className='w-2.5 h-2.5 rounded-full' style={{ background:'linear-gradient(135deg,#e8e8e8,#a0a0a0)', boxShadow:'0 0 12px rgba(200,200,200,0.5)' }}></span>
                <h1 className='font-semibold tracking-tight text-[17px] text-zinc-100'>InterviewIQ</h1>
            </div>

            <div className='flex items-center gap-4 relative'>
                <div className='relative'>
                    <button onClick={()=>{
                        if(!userData){
                            setShowAuth(true)
                            return;
                        }
                        setShowCreditPopup(!showCreditPopup);
                        setShowUserPopup(false)
                    }} className='flex items-center gap-2 px-4 py-2 rounded-full text-sm text-zinc-200 border border-white/10 bg-white/[0.03] hover:border-white/25 transition'>
                        <BsCoin size={18} className='text-zinc-300'/>
                        {userData?.credits || 0}
                    </button>

                    {showCreditPopup && (
                        <div className='absolute right-[-50px] mt-3 w-64 glass rounded-2xl p-5 z-50' style={{ boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }}>
                            <p className='text-sm text-zinc-400 mb-4'>Need more credits to continue interviews?</p>
                            <button onClick={()=>navigate("/pricing")} className='w-full btn-metal py-2.5 rounded-xl text-sm font-semibold'>Buy more credits</button>
                        </div>
                    )}
                </div>

                <div className='relative'>
                    <button
                    onClick={()=>{
                         if(!userData){
                            setShowAuth(true)
                            return;
                        }
                        setShowUserPopup(!showUserPopup);
                        setShowCreditPopup(false)
                    }} className='w-9 h-9 rounded-full flex items-center justify-center font-semibold text-[#0a0a0a]' style={{ background: userData ? 'var(--accent-grad)' : 'rgba(255,255,255,0.06)', color: userData ? '#0a0a0a' : '#e8e8e8' }}>
                        {userData ? userData?.name.slice(0,1).toUpperCase() : <FaUserAstronaut size={16}/>}
                    </button>

                    {showUserPopup && (
                        <div className='absolute right-0 mt-3 w-52 glass rounded-2xl p-4 z-50' style={{ boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }}>
                            <p className='text-sm text-metal font-semibold mb-2'>{userData?.name}</p>
                            <button onClick={()=>navigate("/history")} className='w-full text-left text-sm py-2 text-zinc-400 hover:text-zinc-100 transition'>Interview History</button>
                            <button onClick={handleLogout}
                            className='w-full text-left text-sm py-2 flex items-center gap-2 text-red-400 hover:text-red-300 transition'>
                                <HiOutlineLogout size={16}/>
                                Logout</button>
                        </div>
                    )}
                </div>

            </div>
        </motion.div>

        {showAuth && <AuthModel onClose={()=>setShowAuth(false)}/>}

    </div>
  )
}

export default Navbar
