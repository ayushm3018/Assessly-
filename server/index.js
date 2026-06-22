import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/connectDb.js"
import cookieParser from "cookie-parser"
dotenv.config()
import cors from "cors"
import authRouter from "./routes/auth.route.js"
import userRouter from "./routes/user.route.js"
import interviewRouter from "./routes/interview.route.js"
import paymentRouter from "./routes/payment.route.js"
import { globalLimiter } from "./middlewares/rateLimit.js"

const app = express()

// In production the app sits behind nginx, which forwards the real client IP in
// X-Forwarded-For. Trust exactly ONE proxy hop so the rate limiter keys off that
// real IP (not the nginx container IP, which would make all users share a bucket).
// In local dev there's no proxy, so don't trust the header — it'd be spoofable.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false)

// Allowed browser origins. In production the app is same-origin behind nginx, but
// we still set CLIENT_URL (the public https URL) as a safety net. Locally it falls
// back to the Vite dev server. Comma-separate to allow more than one origin.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)

app.use(cors({
    origin: allowedOrigins,
    credentials:true
}))

app.use(express.json())
app.use(cookieParser())

// Broad per-IP backstop on the whole API; individual routes add tighter caps.
app.use("/api", globalLimiter)

app.use("/api/auth" , authRouter)
app.use("/api/user", userRouter)
app.use("/api/interview" , interviewRouter)
app.use("/api/payment" , paymentRouter)

const PORT = process.env.PORT || 6000
app.listen(PORT , ()=>{
    console.log(`Server running on port ${PORT}`)
    connectDb()
})
