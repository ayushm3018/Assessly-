import React, { useState } from 'react'
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import { motion } from "motion/react";
import axios from 'axios';
import { ServerUrl } from '../App';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import AnimatedBackground from '../components/AnimatedBackground';
function Pricing() {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const dispatch = useDispatch()

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "₹0",
      credits: 100,
      description: "Perfect for beginners starting interview preparation.",
      features: [
        "100 AI Interview Credits",
        "Basic Performance Report",
        "Voice Interview Access",
        "Limited History Tracking",
      ],
      default: true,
    },
    {
      id: "basic",
      name: "Starter Pack",
      price: "₹100",
      credits: 150,
      description: "Great for focused practice and skill improvement.",
      features: [
        "150 AI Interview Credits",
        "Detailed Feedback",
        "Performance Analytics",
        "Full Interview History",
      ],
    },
    {
      id: "pro",
      name: "Pro Pack",
      price: "₹500",
      credits: 650,
      description: "Best value for serious job preparation.",
      features: [
        "650 AI Interview Credits",
        "Advanced AI Feedback",
        "Skill Trend Analysis",
        "Priority AI Processing",
      ],
      badge: "Best Value",
    },
  ];



  const handlePayment = async (plan) => {
    try {
      setLoadingPlan(plan.id)

      const amount =
      plan.id === "basic" ? 100 :
      plan.id === "pro" ? 500 : 0;

      const result = await axios.post(ServerUrl + "/api/payment/order" , {
        planId: plan.id,
        amount: amount,
        credits: plan.credits,
      },{withCredentials:true})


      const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: result.data.amount,
      currency: "INR",
      name: "InterviewIQ.AI",
      description: `${plan.name} - ${plan.credits} Credits`,
      order_id: result.data.id,

      handler:async function (response) {
        const verifypay = await axios.post(ServerUrl + "/api/payment/verify" ,response , {withCredentials:true})
        dispatch(setUserData(verifypay.data.user))

          alert("Payment Successful 🎉 Credits Added!");
          navigate("/")

      },
      theme:{
        color: "#c0c0c0",
      },

      }

      const rzp = new window.Razorpay(options)
      rzp.open()

      setLoadingPlan(null);
    } catch (error) {
     console.log(error)
     setLoadingPlan(null);
    }
  }



  return (
    <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />
      <div className='relative z-10 max-w-6xl mx-auto px-6 py-16'>

        <div className='flex items-start gap-4 mb-14'>
          <button onClick={() => navigate("/")} className='mt-2 p-3 rounded-full glass hover:border-white/25 transition'>
            <FaArrowLeft className='text-zinc-300' />
          </button>
          <div className="text-center w-full">
            <div className='text-xs tracking-[0.3em] uppercase text-zinc-500 font-semibold'>Pricing</div>
            <h1 className="text-4xl font-extralight tracking-tight text-zinc-50 mt-3">Choose Your Plan</h1>
            <p className="text-zinc-400 mt-3 font-light">Flexible pricing to match your interview preparation goals.</p>
          </div>
        </div>

        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-7'>
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id
            return (
              <motion.div key={plan.id}
                whileHover={!plan.default ? { y: -6 } : {}}
                onClick={() => !plan.default && setSelectedPlan(plan.id)}
                className={`relative glass rounded-3xl p-8 transition-all duration-300 ${plan.default ? "cursor-default" : "cursor-pointer"}`}
                style={isSelected ? { borderColor: 'rgba(192,192,192,0.5)', boxShadow: '0 0 50px rgba(200,200,200,0.12)' } : {}}>

                {plan.badge && (
                  <div className="absolute top-6 right-6 btn-metal text-xs px-4 py-1 rounded-full font-semibold">{plan.badge}</div>
                )}
                {plan.default && (
                  <div className="absolute top-6 right-6 bg-white/[0.06] text-zinc-400 text-xs px-3 py-1 rounded-full border border-white/10">Default</div>
                )}

                <h3 className="text-xl font-medium text-zinc-100">{plan.name}</h3>

                <div className="mt-4">
                  <span className="text-3xl font-light text-metal">{plan.price}</span>
                  <p className="text-zinc-500 mt-1 font-light">{plan.credits} Credits</p>
                </div>

                <p className="text-zinc-400 mt-4 text-sm leading-relaxed font-light">{plan.description}</p>

                <div className="mt-6 space-y-3 text-left">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <FaCheckCircle className="text-zinc-400 text-sm" />
                      <span className="text-zinc-300 text-sm font-light">{feature}</span>
                    </div>
                  ))}
                </div>

                {!plan.default &&
                  <button
                  disabled={loadingPlan === plan.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelected) {
                        setSelectedPlan(plan.id)
                      } else {
                        handlePayment(plan)
                      }
                    }} className={`w-full mt-8 py-3 rounded-xl font-semibold transition ${isSelected
                      ? "btn-metal"
                      : "bg-white/[0.04] text-zinc-300 border border-white/10 hover:border-white/25"
                      }`}>
                    {loadingPlan === plan.id
                      ? "Processing..."
                      : isSelected
                        ? "Proceed to Pay"
                        : "Select Plan"}
                  </button>
                }
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Pricing
