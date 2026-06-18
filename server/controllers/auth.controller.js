import genToken from "../config/token.js"
import User from "../models/user.model.js"
import { adminAuth } from "../config/firebaseAdmin.js"


export const googleAuth = async (req,res) => {
    try {
        const {idToken} = req.body

        if(!idToken){
            return res.status(400).json({message:"Missing Google ID token"})
        }

        // Verify the token with Firebase. This is the fix that makes auth
        // non-spoofable: the email now comes from a cryptographically verified
        // Google token, not from whatever the client typed in the request body.
        const decoded = await adminAuth.verifyIdToken(idToken)

        const email = decoded.email
        const name = decoded.name || decoded.email?.split("@")[0] || "User"

        if(!email){
            return res.status(400).json({message:"Token does not contain an email"})
        }

        let user = await User.findOne({email})
        if(!user){
            user = await User.create({
                name ,
                email
            })
        }
        let token = await genToken(user._id)
        res.cookie("token" , token , {
            httpOnly:true,
            secure:false, // set true in production (HTTPS)
            sameSite:"strict",
            maxAge:7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(user)



    } catch (error) {
        return res.status(401).json({message:`Google auth failed: ${error}`})
    }

}

export const logOut = async (req,res) => {
    try {
        await res.clearCookie("token")
        return res.status(200).json({message:"LogOut Successfully"})
    } catch (error) {
         return res.status(500).json({message:`Logout error ${error}`})
    }
    
}