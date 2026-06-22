import express from "express"
import { googleAuth, logOut } from "../controllers/auth.controller.js"
import { authLimiter } from "../middlewares/rateLimit.js"

const authRouter = express.Router()


authRouter.post("/google",authLimiter,googleAuth)
authRouter.get("/logout",logOut)


export default authRouter