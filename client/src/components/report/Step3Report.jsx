import React from 'react'
import { FaArrowLeft } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'
import AnimatedBackground from '../AnimatedBackground'
import { downloadInterviewReportPdf } from '../../utils/interviewReportPdf'
import TerminatedBanner from './TerminatedBanner'
import ScoreHero from './ScoreHero'
import MetricRings from './MetricRings'
import PerformanceTrendChart from './PerformanceTrendChart'
import QuestionBreakdown from './QuestionBreakdown'

/**
 * Final interview report. Pure layout + data destructuring — each section is its
 * own component and the PDF export lives in utils/interviewReportPdf.
 */
function Step3Report({ report }) {
  const navigate = useNavigate();

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
        <p className="text-zinc-500 text-lg">Loading Report...</p>
      </div>
    );
  }

  const {
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report;

  // A terminated run is void: force a 0 score and show why.
  const isTerminated = report.terminated || report.status === "terminated";

  return (
    <div className='relative min-h-screen' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground />

      <div className='relative z-10 max-w-5xl mx-auto px-5 sm:px-6 py-12'>

        {/* header */}
        <div className='flex items-center justify-between gap-4 mb-12'>
          <button
            onClick={() => navigate("/history")}
            className='p-3 rounded-full glass hover:border-white/25 transition'><FaArrowLeft className='text-zinc-300' /></button>
          <button onClick={() => downloadInterviewReportPdf(report)} className='btn-metal px-6 py-3 rounded-xl font-semibold text-sm'>Download PDF</button>
        </div>

        {isTerminated && <TerminatedBanner reasons={report.violationReasons} />}

        <ScoreHero isTerminated={isTerminated} finalScore={finalScore} />

        <MetricRings confidence={confidence} communication={communication} correctness={correctness} />

        <PerformanceTrendChart questionWiseScore={questionWiseScore} />

        <QuestionBreakdown questionWiseScore={questionWiseScore} />

        {/* CTAs */}
        <div className='flex flex-wrap gap-3.5 mt-12'>
          <button onClick={() => navigate("/interview")} className='btn-metal h-[50px] px-7 rounded-[14px] font-semibold text-sm'>Start New Interview</button>
          <button onClick={() => navigate("/history")} className='h-[50px] px-7 rounded-[14px] bg-transparent text-zinc-100 font-medium border border-[rgba(192,192,192,0.4)] hover:border-[rgba(232,232,232,0.7)] transition text-sm'>View History</button>
        </div>
      </div>
    </div>
  );
}

export default Step3Report
