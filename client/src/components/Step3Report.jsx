import React from 'react'
import { FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { motion } from "motion/react"
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import AnimatedBackground from './AnimatedBackground';

function Step3Report({ report }) {
  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
        <p className="text-zinc-500 text-lg">Loading Report...</p>
      </div>
    );
  }
  const navigate = useNavigate()
  const {
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report;

  // A terminated run is void: force a 0 score and show why.
  const isTerminated = report.terminated || report.status === "terminated";
  const reasonLabels = {
    "phone-detected": "phone detected",
    "multiple-faces": "another person in frame",
    "no-face": "candidate not visible",
    "looking-away": "looking away from screen",
    "tab-switch": "switched tab",
    "fullscreen-exit": "exited fullscreen",
    "window-blur": "switched window/app",
  };
  const terminationReasons = (report.violationReasons || [])
    .map((r) => reasonLabels[r] || r)
    .join(", ");

  const questionScoreData = questionWiseScore.map((score, index) => ({
    name: `Q${index + 1}`,
    score: score.score || 0
  }))

  const skills = [
    { label: "Confidence", value: confidence },
    { label: "Communication", value: communication },
    { label: "Correctness", value: correctness },
  ];

  let performanceText = "";
  let shortTagline = "";

  if (finalScore >= 8) {
    performanceText = "Ready for job opportunities.";
    shortTagline = "Excellent clarity and structured responses.";
  } else if (finalScore >= 5) {
    performanceText = "Needs minor improvement before interviews.";
    shortTagline = "Good foundation, refine articulation.";
  } else {
    performanceText = "Significant improvement required.";
    shortTagline = "Work on clarity and confidence.";
  }

  // metallic / amber / red badge depending on score band
  const badge = (v) => {
    if (v >= 8) return 'linear-gradient(135deg,#c0c0c0,#ffffff,#a0a0a0)';
    if (v >= 6) return 'linear-gradient(135deg,#fbbf24,#fcd34d,#f59e0b)';
    return 'linear-gradient(135deg,#f87171,#fca5a5,#ef4444)';
  };

  const ring = (value, label) => (
    <div className='flex flex-col items-center glass rounded-[20px] p-7'>
      <div className='w-28 h-28'>
        <CircularProgressbar
          value={value * 10}
          text={`${value}`}
          styles={buildStyles({
            textSize: "22px",
            pathColor: "#e8e8e8",
            textColor: "#fafafa",
            trailColor: "rgba(255,255,255,0.07)",
          })}
        />
      </div>
      <div className='mt-3.5 text-sm text-zinc-300'>{label}</div>
    </div>
  );


  const downloadPDF = () => {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let currentY = 25;

  // ================= TITLE =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(34, 197, 94);
  doc.text("AI Interview Performance Report", pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 5;

  // underline
  doc.setDrawColor(34, 197, 94);
  doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

  currentY += 15;

  // ================= FINAL SCORE BOX =================
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, "F");

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Final Score: ${finalScore}/10`,
    pageWidth / 2,
    currentY + 12,
    { align: "center" }
  );

  currentY += 30;

  // ================= SKILLS BOX =================
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, currentY, contentWidth, 30, 4, 4, "F");

  doc.setFontSize(12);

  doc.text(`Confidence: ${confidence}`, margin + 10, currentY + 10);
  doc.text(`Communication: ${communication}`, margin + 10, currentY + 18);
  doc.text(`Correctness: ${correctness}`, margin + 10, currentY + 26);

  currentY += 45;

  // ================= ADVICE =================
  let advice = "";

  if (finalScore >= 8) {
    advice =
      "Excellent performance. Maintain confidence and structure. Continue refining clarity and supporting answers with strong real-world examples.";
  } else if (finalScore >= 5) {
    advice =
      "Good foundation shown. Improve clarity and structure. Practice delivering concise, confident answers with stronger supporting examples.";
  } else {
    advice =
      "Significant improvement required. Focus on structured thinking, clarity, and confident delivery. Practice answering aloud regularly.";
  }

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220);
  doc.roundedRect(margin, currentY, contentWidth, 35, 4, 4);

  doc.setFont("helvetica", "bold");
  doc.text("Professional Advice", margin + 10, currentY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const splitAdvice = doc.splitTextToSize(advice, contentWidth - 20);
  doc.text(splitAdvice, margin + 10, currentY + 20);

  currentY += 50;

  // ================= QUESTION TABLE =================
  autoTable(doc, {
  startY: currentY,
  margin: { left: margin, right: margin },
  head: [["#", "Question", "Score", "Feedback"]],
  body: questionWiseScore.map((q, i) => [
    `${i + 1}`,
    q.question,
    `${q.score}/10`,
    q.feedback,
  ]),
  styles: {
    fontSize: 9,
    cellPadding: 5,
    valign: "top",
  },
  headStyles: {
    fillColor: [34, 197, 94],
    textColor: 255,
    halign: "center",
  },
  columnStyles: {
    0: { cellWidth: 10, halign: "center" }, // index
    1: { cellWidth: 55 }, // question
    2: { cellWidth: 20, halign: "center" }, // score
    3: { cellWidth: "auto" }, // feedback
  },
  alternateRowStyles: {
    fillColor: [249, 250, 251],
  },
});


  doc.save("AI_Interview_Report.pdf");
};

  return (
    <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

      <div className='relative z-10 max-w-5xl mx-auto px-5 sm:px-6 py-12'>

        {/* header */}
        <div className='flex items-center justify-between gap-4 mb-12'>
          <button
            onClick={() => navigate("/history")}
            className='p-3 rounded-full glass hover:border-white/25 transition'><FaArrowLeft className='text-zinc-300' /></button>
          <button onClick={downloadPDF} className='btn-metal px-6 py-3 rounded-xl font-semibold text-sm'>Download PDF</button>
        </div>

        {/* terminated banner */}
        {isTerminated && (
          <div className='mb-8 rounded-2xl px-6 py-5 flex items-start gap-4 border'
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' }}>
            <span className='flex-none w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold'
              style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>!</span>
            <div>
              <p className='font-semibold text-red-300'>Interview Terminated</p>
              <p className='text-sm text-zinc-400 font-light mt-1 leading-relaxed'>
                This interview was terminated after 3 proctoring violations. The score has been recorded as 0.
              </p>
              {terminationReasons && (
                <p className='text-sm text-zinc-300 font-light mt-2 leading-relaxed'>
                  <span className='text-zinc-500'>Detected:</span> {terminationReasons}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* hero score */}
        <div className='text-center'>
          <div className='text-xs tracking-[0.3em] uppercase text-zinc-500 font-semibold'>
            {isTerminated ? "Session Terminated" : "Session Complete"}
          </div>
          <div className={`font-extralight leading-none mt-4 ${isTerminated ? '' : 'text-metal'}`}
            style={{ fontSize: 'clamp(96px,15vw,168px)', filter: 'drop-shadow(0 0 40px rgba(200,200,200,0.2))', color: isTerminated ? '#f87171' : undefined }}>
            {isTerminated ? "0.0" : Number(finalScore || 0).toFixed(1)}
          </div>
          <div className='text-zinc-400 font-light tracking-wide'>Overall Score · out of 10</div>
          {!isTerminated && (
            <div className='mt-4'>
              <p className='font-medium text-zinc-100'>{performanceText}</p>
              <p className='text-zinc-500 text-sm mt-1 font-light'>{shortTagline}</p>
            </div>
          )}
        </div>

        {/* metric rings */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-5 mt-16'>
          {ring(confidence, "Confidence")}
          {ring(communication, "Communication")}
          {ring(correctness, "Correctness")}
        </div>

        {/* performance trend */}
        <div className='glass rounded-[20px] p-5 sm:p-7 mt-6'>
          <div className='text-[13px] tracking-[0.18em] uppercase text-zinc-500 font-semibold mb-5'>Performance Trend</div>
          <div className='h-64'>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={questionScoreData}>
                <defs>
                  <linearGradient id="silverArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(232,232,232,0.45)" />
                    <stop offset="100%" stopColor="rgba(232,232,232,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#7d7d86" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} stroke="#7d7d86" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#141418', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f4f4f5' }} />
                <Area type="monotone" dataKey="score" stroke="#e8e8e8" fill="url(#silverArea)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* question breakdown */}
        <div className='mt-12'>
          <div className='text-[13px] tracking-[0.18em] uppercase text-zinc-500 font-semibold mb-5'>Question Breakdown</div>
          <div className='flex flex-col gap-3'>
            {questionWiseScore.map((q, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className='glass rounded-2xl p-5'>
                <div className='flex items-start gap-4'>
                  <span className='flex-none w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-[#0a0a0a]'
                    style={{ background: badge(q.score ?? 0) }}>{q.score ?? 0}</span>
                  <div className='flex-1'>
                    <p className='text-[11px] text-zinc-500'>Question {i + 1}</p>
                    <p className='font-medium text-zinc-100 text-sm leading-relaxed mt-0.5'>
                      {q.question || "Question not available"}
                    </p>
                    <p className='text-sm text-zinc-400 font-light leading-relaxed mt-3'>
                      {q.feedback && q.feedback.trim() !== "" ? q.feedback : "No feedback available for this question."}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className='flex flex-wrap gap-3.5 mt-12'>
          <button onClick={() => navigate("/interview")} className='btn-metal h-[50px] px-7 rounded-[14px] font-semibold text-sm'>Start New Interview</button>
          <button onClick={() => navigate("/history")} className='h-[50px] px-7 rounded-[14px] bg-transparent text-zinc-100 font-medium border border-[rgba(192,192,192,0.4)] hover:border-[rgba(232,232,232,0.7)] transition text-sm'>View History</button>
        </div>
      </div>
    </div>
  )
}

export default Step3Report
