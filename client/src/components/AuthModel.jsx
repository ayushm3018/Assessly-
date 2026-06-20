import React from 'react'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { FaTimes } from "react-icons/fa";
import { motion } from "motion/react"
import Auth from '../pages/Auth';

function AuthModel({onClose}) {
    const {userData} = useSelector((state)=>state.user)

    useEffect(()=>{
        if(userData){
            onClose()
        }

    },[userData , onClose])

  return (
    <div className='fixed inset-0 z-999 flex items-center justify-center px-4'
      style={{ background:'rgba(4,4,6,0.72)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
        <motion.div
          initial={{ opacity:0, scale:0.96 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ duration:0.3 }}
          className='relative w-full max-w-md'>
            <button onClick={onClose} className='absolute -top-3 -right-1 z-10 text-zinc-400 hover:text-zinc-100 transition'>
             <FaTimes size={18}/>
            </button>
            <Auth isModel={true}/>
        </motion.div>
    </div>
  )
}

export default AuthModel
