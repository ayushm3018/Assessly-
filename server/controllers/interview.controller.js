import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi, askAiJson } from "../services/openRouter.service.js";
import { synthesizeSpeech } from "../services/tts.service.js";
import { createDeepgramToken } from "../services/deepgram.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

// A candidate may leave the interview surface (switch tab, exit fullscreen,
// switch apps) this many times before the interview is auto-terminated.
const MAX_VIOLATIONS = 3;

// Turns the candidate's experience into a difficulty + timing plan so the
// experience they enter actually changes the interview structure (harder
// progression and more thinking time for seniors), not just a prompt hint.
const getDifficultyPlan = (experience) => {
  const raw = String(experience || "");
  const match = raw.match(/\d+/);
  const years = match ? parseInt(match[0], 10) : 0;
  const isFresher = /fresher|intern|entry|student/i.test(raw) || years === 0;

  if (!isFresher && years >= 6) {
    return {
      level: "senior",
      difficulties: ["medium", "medium", "hard", "hard", "hard"],
      timeLimits: [90, 90, 120, 120, 150],
    };
  }

  if (!isFresher && years >= 3) {
    return {
      level: "mid-level",
      difficulties: ["easy", "medium", "medium", "hard", "hard"],
      timeLimits: [60, 90, 90, 120, 120],
    };
  }

  return {
    level: "junior",
    difficulties: ["easy", "easy", "medium", "medium", "hard"],
    timeLimits: [60, 60, 90, 90, 120],
  };
};

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume required" });
    }
    const filepath = req.file.path

    const fileBuffer = await fs.promises.readFile(filepath)
    const uint8Array = new Uint8Array(fileBuffer)

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");
      resumeText += pageText + "\n";
    }


    resumeText = resumeText
      .replace(/\s+/g, " ")
      .trim();

    const messages = [
      {
        role: "system",
        content: `
You analyze an uploaded document to extract resume/CV data.

FIRST decide whether this document is actually a resume or CV — i.e. it describes a specific person's professional profile (work experience, education, skills, and/or projects). If it is NOT a resume (random text, an article, an invoice, a cover letter only, marketing copy, gibberish, or anything unrelated), set "isResume" to false and leave the other fields empty.

Return strictly JSON:

{
  "isResume": true or false,
  "role": "the candidate's target or most recent role (e.g. 'Frontend Engineer'), or empty string",
  "experience": "short experience phrase like 'Fresher', '2 years', '5 years', or empty string",
  "projects": ["short project name or description", "..."],
  "skills": ["skill", "..."]
}
`
      },
      {
        role: "user",
        content: resumeText
      }
    ];


    const parsed = await askAiJson(messages)

    fs.unlinkSync(filepath)

    // Reject anything that isn't actually a resume so the interview can't run on
    // an unrelated document. Also guard against an empty extraction.
    if (parsed.isResume === false || !resumeText || resumeText.length < 40) {
      return res.status(422).json({
        isResume: false,
        message: "This doesn't look like a resume. Please upload your actual resume (PDF).",
      });
    }


    res.json({
      isResume: true,
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      resumeText
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};


export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills } = req.body

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and Mode are required." })
    }

    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.credits < 50) {
      return res.status(400).json({
        message: "Not enough credits. Minimum 50 required."
      });
    }

    // The interview is resume-based, so a real resume is required.
    const safeResume = resumeText?.trim() || "";
    if (!safeResume || safeResume.length < 40) {
      return res.status(400).json({
        message: "A resume is required. Please upload your resume so the interview can be based on it.",
      });
    }

    const projectText = Array.isArray(projects) && projects.length
      ? projects.join(", ")
      : "None";

    const skillsText = Array.isArray(skills) && skills.length
      ? skills.join(", ")
      : "None";

    // Decide difficulty/timing from experience, and describe the progression to the AI.
    const plan = getDifficultyPlan(experience);
    const progressionText = plan.difficulties
      .map((d, i) => `Question ${i + 1} → ${d}`)
      .join("\n");

    const userPrompt = `
    Role:${role}
    Experience:${experience}
    InterviewMode:${mode}
    Projects:${projectText}
    Skills:${skillsText},
    Resume:${safeResume}
    `;

    if (!userPrompt.trim()) {
      return res.status(400).json({
        message: "Prompt content is empty."
      });
    }

    const messages = [

      {
        role: "system",
        content: `
You are an experienced, sharp human interviewer conducting a professional ${mode} interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions that genuinely probe the candidate's depth, not surface-level trivia.

This is a RESUME-BASED interview. The candidate's resume is provided below and is the primary source for your questions.

Question design rules:
- Ground every question in the candidate's ACTUAL resume — their named projects, listed skills, and stated experience. At least 3 of the 5 questions must explicitly reference a specific project or skill from the resume (name it).
- Do NOT ask generic role questions that ignore the resume. If the resume mentions a project, dig into the decisions, trade-offs, and challenges of THAT project.
- Use the role only as a lens for depth/level — the substance must come from the resume.
- For a Technical interview: ask about real decisions, trade-offs, debugging, and how they would design or improve something from their resume. Avoid pure definition questions.
- For an HR interview: ask about real situations, conflict, ownership, and motivation using behavioral ("tell me about a time...") framing.
- This candidate is at a ${plan.level} level (experience: ${experience}). Pitch the questions at that level — do not ask a senior trivially easy questions or a fresher unrealistic ones.
- Each question should invite a substantive, explainable answer (not yes/no).

Strict output format:
- Each question must contain between 15 and 25 words.
- Each question must be a single complete sentence.
- Do NOT number them.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- One question per line only.

Difficulty progression (follow this exactly, in order):
${progressionText}
`
      }
      ,
      {
        role: "user",
        content: userPrompt
      }
    ];


    const aiResponse = await askAi(messages)

    if (!aiResponse || !aiResponse.trim()) {
           
      return res.status(500).json({
        message: "AI returned empty response."
      });

    }

    const questionsArray = aiResponse
      .split("\n")
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .slice(0, 5);

    if (questionsArray.length === 0) {
      
      return res.status(500).json({
        message: "AI failed to generate questions."
      });
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      questions: questionsArray.map((q, index) => ({
        question: q,
        difficulty: plan.difficulties[index],
        timeLimit: plan.timeLimits[index],
      }))
    })

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      questions: interview.questions
    });
  } catch (error) {
    return res.status(500).json({message:`failed to create interview ${error}`})
  }
}


export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body

    const interview = await Interview.findById(interviewId)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Ownership check: a logged-in user may only touch their own interview.
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    const question = interview.questions[questionIndex]

    // If no answer
    if (!answer) {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";

      await interview.save();

      return res.json({
        feedback: question.feedback,
        followUp: null
      });
    }

    // If time exceeded
    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = answer;

      await interview.save();

      return res.json({
        feedback: question.feedback,
        followUp: null
      });
    }


    // We only let the AI cross-question a main question, never a follow-up.
    // This keeps the interview from spiralling into endless follow-up chains.
    const allowFollowUp = !question.isFollowUp;

    const messages = [
      {
        role: "system",
        content: `
You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (0 to 10):

1. Confidence – Does the answer sound clear, confident, and well-presented?
2. Communication – Is the language simple, clear, and easy to understand?
3. Correctness – Is the answer accurate, relevant, and complete?

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write in-depth, genuinely useful feedback the candidate can learn from (this is shown only in their final report, not during the interview).
- Up to 4 lines maximum — roughly 40 to 70 words. Never exceed 4 lines.
- Be specific: what was strong, what was missing or weak, and one concrete way to improve.
- Do NOT repeat the question. Do NOT explain the scoring numbers.
- Keep the tone professional, honest, and constructive.

Follow-up question:
${allowFollowUp
  ? `Decide if this answer deserves ONE follow-up question to dig deeper — like a real interviewer would cross-question.
- Ask a follow-up ONLY when the answer is substantive but leaves something worth probing (a vague claim to clarify, a decision to justify, or depth to test).
- If the answer is empty, off-topic, or too weak to build on, set "followUp" to null.
- The follow-up must directly reference what the candidate actually said.
- Keep it a single conversational sentence, 15 to 25 words.`
  : `Do NOT ask any follow-up question. Always set "followUp" to null.`}

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback",
  "followUp": "a single follow-up question, or null"
}
`
      }
      ,
      {
        role: "user",
        content: `
Question: ${question.question}
Answer: ${answer}
`
      }
    ];


    const parsed = await askAiJson(messages)

    question.answer = answer;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.score = parsed.finalScore;
    question.feedback = parsed.feedback;

    // If the interviewer chose to cross-question, insert the follow-up right
    // after the current question so the DB order matches what the client shows.
    let followUp = null;
    const followUpText =
      allowFollowUp && typeof parsed.followUp === "string"
        ? parsed.followUp.trim()
        : "";

    if (followUpText && followUpText.toLowerCase() !== "null") {
      followUp = {
        question: followUpText,
        difficulty: question.difficulty || "medium",
        timeLimit: 90,
        isFollowUp: true,
      };
      interview.questions.splice(questionIndex + 1, 0, followUp);
    }

    await interview.save();

    return res.status(200).json({
      feedback: parsed.feedback,
      followUp,
    })
  } catch (error) {
    return res.status(500).json({message:`failed to submit answer ${error}`})

  }
}


export const finishInterview = async (req,res) => {
  try {
    const {interviewId} = req.body
    const interview = await Interview.findById(interviewId)
    if(!interview){
      return res.status(400).json({message:"failed to find Interview"})
    }

    // Ownership check
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    // A terminated interview can never be "finished" into a real score —
    // always return the locked, zeroed terminated report.
    if (interview.status === "terminated") {
      return res.status(200).json(buildTerminatedReport(interview));
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions
      ? totalScore / totalQuestions
      : 0;

    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    await interview.save();

    return res.status(200).json({
       finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
      })),
    })
  } catch (error) {
    return res.status(500).json({message:`failed to finish Interview ${error}`})
  }
}


// Shared shape for a terminated interview's report. Score is always 0 and all
// metrics are zeroed — the run is void, regardless of partial answers.
const buildTerminatedReport = (interview) => ({
  terminated: true,
  status: "terminated",
  violationCount: interview.violationCount,
  // De-duplicated list of what was detected, so the report can explain why.
  violationReasons: [...new Set((interview.violations || []).map((v) => v.reason).filter(Boolean))],
  finalScore: 0,
  confidence: 0,
  communication: 0,
  correctness: 0,
  questionWiseScore: interview.questions.map((q) => ({
    question: q.question,
    score: q.score || 0,
    feedback: q.feedback || "",
    confidence: q.confidence || 0,
    communication: q.communication || 0,
    correctness: q.correctness || 0,
  })),
});

// Records a single proctoring violation reported by the client and, once the
// threshold is crossed, terminates the interview with a locked score of 0.
// The count and the terminate decision live here (not in the browser) so they
// can't be tampered with — the client only reports that something happened.
export const recordViolation = async (req, res) => {
  try {
    const { interviewId, reason } = req.body;

    if (!interviewId) {
      return res.status(400).json({ message: "interviewId is required" });
    }

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Ownership check: only the owner can affect their own interview.
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    // Idempotency: a finished or already-terminated interview is immutable.
    if (interview.status === "terminated") {
      return res.status(200).json(buildTerminatedReport(interview));
    }
    if (interview.status === "completed") {
      return res.status(200).json({
        terminated: false,
        completed: true,
        violationCount: interview.violationCount,
        warningsLeft: Math.max(0, MAX_VIOLATIONS - interview.violationCount),
      });
    }

    // Atomic increment, guarded on status so concurrent reports can't re-count a
    // run that another request already terminated.
    const updated = await Interview.findOneAndUpdate(
      { _id: interviewId, userId: req.userId, status: "Incompleted" },
      {
        $inc: { violationCount: 1 },
        $push: { violations: { reason: reason || "unknown", at: new Date() } },
      },
      { new: true }
    );

    // The status changed out from under us (e.g. terminated by a racing request).
    if (!updated) {
      const fresh = await Interview.findById(interviewId);
      if (fresh?.status === "terminated") {
        return res.status(200).json(buildTerminatedReport(fresh));
      }
      return res.status(409).json({ message: "Interview is no longer in progress" });
    }

    if (updated.violationCount >= MAX_VIOLATIONS) {
      updated.status = "terminated";
      updated.finalScore = 0;
      await updated.save();
      return res.status(200).json(buildTerminatedReport(updated));
    }

    return res.status(200).json({
      terminated: false,
      violationCount: updated.violationCount,
      warningsLeft: MAX_VIOLATIONS - updated.violationCount,
    });
  } catch (error) {
    return res.status(500).json({ message: `failed to record violation ${error}` });
  }
};

export const getMyInterviews = async (req,res) => {
  try {
    const interviews = await Interview.find({userId:req.userId})
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews)

  } catch (error) {
     return res.status(500).json({message:`failed to find currentUser Interview ${error}`})
  }
}

export const getInterviewReport = async (req,res) => {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Ownership check: prevents reading someone else's report by guessing its id.
    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not authorized for this interview" });
    }

    // A terminated run is void — return the locked, zeroed report.
    if (interview.status === "terminated") {
      return res.json(buildTerminatedReport(interview));
    }


    const totalQuestions = interview.questions.length;

    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });
    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

       return res.json({
      status: interview.status,
      terminated: false,
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions
    });

  } catch (error) {
    return res.status(500).json({message:`failed to find currentUser Interview report ${error}`})
  }
}


export const textToSpeech = async (req, res) => {
  try {
    const { text, gender } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required." });
    }

    const audio = await synthesizeSpeech(text, gender);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length,
    });

    return res.send(audio);
  } catch (error) {
    return res.status(500).json({ message: `TTS failed ${error}` });
  }
}

// Mints a short-lived Deepgram token so the browser can open a live speech-to-text
// socket for real-time transcription, without ever seeing the long-lived API key.
export const getDeepgramToken = async (req, res) => {
  try {
    const token = await createDeepgramToken();
    return res.status(200).json(token); // { accessToken, expiresIn }
  } catch (error) {
    // Log the real cause to the server console — the client only sees a generic
    // message. A 403 here means the API key lacks the "Member" role (token auth).
    console.error("[deepgram] token grant failed:", error?.message || error);
    return res.status(500).json({ message: `Failed to issue speech token: ${error.message}` });
  }
}




