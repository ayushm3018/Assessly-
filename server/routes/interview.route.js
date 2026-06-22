import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { upload } from "../middlewares/multer.js"
import { analyzeResume, finishInterview, generateQuestion, getDeepgramToken, getInterviewReport, getMyInterviews, recordViolation, submitAnswer, textToSpeech } from "../controllers/interview.controller.js"
import { resumeLimiter, generateLimiter, answerLimiter, ttsLimiter, deepgramLimiter } from "../middlewares/rateLimit.js"




const interviewRouter = express.Router()

// Per-user limiters sit AFTER isAuth so they can key on req.userId. The paid /
// un-credited endpoints (resume, submit-answer, tts, deepgram-token) get tighter
// caps; the cheap DB routes below rely on the global per-IP limiter only.
interviewRouter.post("/resume",isAuth,resumeLimiter,upload.single("resume"),analyzeResume)
interviewRouter.post("/generate-questions",isAuth,generateLimiter,generateQuestion)
interviewRouter.post("/submit-answer",isAuth,answerLimiter,submitAnswer)
interviewRouter.post("/finish",isAuth,finishInterview)
interviewRouter.post("/violation",isAuth,recordViolation)
interviewRouter.post("/tts",isAuth,ttsLimiter,textToSpeech)

interviewRouter.get("/deepgram-token",isAuth,deepgramLimiter,getDeepgramToken)
interviewRouter.get("/get-interview",isAuth,getMyInterviews)
interviewRouter.get("/report/:id",isAuth,getInterviewReport)



export default interviewRouter