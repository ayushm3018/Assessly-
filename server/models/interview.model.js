import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema({
     question: String,
  difficulty: String,
  timeLimit: Number,
  answer: String,
  feedback: String,
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
communication: { type: Number, default: 0 },
correctness: { type: Number, default: 0 },
  // true when this question was generated as a follow-up to the previous answer.
  // Follow-ups never spawn their own follow-ups (prevents endless cross-questioning).
  isFollowUp: { type: Boolean, default: false },
})


const interviewSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    role:{
        type:String,
        required:true
    },
    experience:{
        type:String,
        required:true
    },
    mode:{
        type:String,
        enum:["HR" ,"Technical"],
        required:true
    },
    // Only used to generate the questions at creation time; cleared to "" once the
    // interview is completed or terminated, so we don't keep resume PII at rest for
    // the life of the record. Empty string on a finished interview is expected.
    resumeText:{
     type:String
    },
    questions:[questionsSchema],

    finalScore: { type: Number, default: 0 },

    // Number of proctoring violations (tab switch / exit fullscreen / window
    // switch / camera detections) recorded during the interview. Counted
    // server-side so it can't be tampered with from the browser.
    violationCount: { type: Number, default: 0 },

    // Log of what was detected, so a terminated report can explain *why*.
    violations: {
      type: [
        {
          reason: String,
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    status: {
      type: String,
      enum: ["Incompleted", "completed", "terminated"],
      default: "Incompleted",
    }
},{timestamps:true})

const Interview = mongoose.model("Interview" , interviewSchema)


export default Interview