import React from 'react'
import { IoSparkles } from "react-icons/io5";
import { motion } from "motion/react"
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../utils/firebase';
import axios from 'axios';
import { ServerUrl } from '../App';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import AnimatedBackground from '../components/AnimatedBackground';
function Auth({isModel = false}) {
    const dispatch = useDispatch()

    const handleGoogleAuth = async () => {
        try {
            const response = await signInWithPopup(auth,provider)
            // Send the Firebase ID token (not raw name/email). The server verifies
            // it, so a user can't impersonate anyone by posting a fake email.
            const idToken = await response.user.getIdToken()
            const result = await axios.post(ServerUrl + "/api/auth/google" , {idToken} , {withCredentials:true})
            dispatch(setUserData(result.data))
        } catch (error) {
            console.log(error)
              dispatch(setUserData(null))
        }
    }

    const card = (
        <motion.div
        initial={{opacity:0 , y:-24}}
        animate={{opacity:1 , y:0}}
        transition={{duration:0.8}}
        className={`w-full glass ${isModel ? "max-w-md p-8 rounded-3xl" : "max-w-lg p-12 rounded-[32px]"}`}
        style={{ boxShadow:'0 30px 80px rgba(0,0,0,0.55)' }}>
            <div className='flex items-center justify-center gap-2.5 mb-7'>
                <span className='w-2.5 h-2.5 rounded-full' style={{ background:'linear-gradient(135deg,#e8e8e8,#a0a0a0)', boxShadow:'0 0 12px rgba(200,200,200,0.5)' }}></span>
                <h2 className='font-semibold tracking-tight text-zinc-100'>InterviewIQ</h2>
            </div>

            <h1 className='text-2xl md:text-3xl font-extralight tracking-tight text-center leading-snug mb-4 text-zinc-50'>
                Sign in to begin your
                <span className='inline-flex items-center gap-2 text-metal font-light ml-2'>
                    <IoSparkles size={16}/>
                    AI Interview
                </span>
            </h1>

            <p className='text-zinc-400 text-center text-sm md:text-base leading-relaxed mb-8 font-light'>
                Practice AI-powered mock interviews, track your progress,
                and unlock detailed performance insights.
            </p>

            <motion.button
            onClick={handleGoogleAuth}
            whileHover={{ scale:1.02 }}
            whileTap={{ scale:0.98 }}
            className='w-full flex items-center justify-center gap-3 py-3.5 rounded-full font-semibold btn-metal'>
                <FcGoogle size={20}/>
                Continue with Google
            </motion.button>
        </motion.div>
    )

    if (isModel) return card

    return (
        <div className='relative min-h-screen flex items-center justify-center px-6 py-20' style={{ background:'#080808' }}>
            <AnimatedBackground />
            <div className='relative z-10 w-full flex justify-center'>
                {card}
            </div>
        </div>
    )
}

export default Auth
