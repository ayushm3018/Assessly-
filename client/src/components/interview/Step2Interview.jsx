import React, { useRef } from 'react'
import AnimatedBackground from '../AnimatedBackground'
import useTextToSpeech from '../../hooks/useTextToSpeech'
import useDeepgramSpeech from '../../hooks/useDeepgramSpeech'
import useInterviewFlow from '../../hooks/useInterviewFlow'
import useInterviewProctoring from '../../hooks/useInterviewProctoring'
import CalibrationScreen from './CalibrationScreen'
import InterviewStartScreen from './InterviewStartScreen'
import WarningOverlay from './WarningOverlay'
import CameraToast from './CameraToast'
import SelfViewPreview from './SelfViewPreview'
import InterviewStage from './InterviewStage'
import ProgressSidebar from './ProgressSidebar'
import ProctorDebugOverlay from './ProctorDebugOverlay'

// Dev-only proctoring metrics: on in `vite dev`, or force with ?debug in any build.
const SHOW_PROCTOR_DEBUG =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

/**
 * Orchestrator for the proctored interview. It owns no UI logic of its own —
 * it instantiates the four interview hooks, wires the cross-cutting callbacks
 * between them, and picks which screen to render. Each concern (speech, TTS,
 * question flow, proctoring) lives in its own hook; each screen in its own
 * component.
 */
function Step2Interview({ interviewData, onFinish }) {
  const { interviewId } = interviewData;

  const rootRef = useRef(null);
  const orbRef = useRef(null);
  // Latest-refs so the hooks can call into each other without an instantiation
  // ordering problem (cross-hook calls only happen at runtime, after render).
  const speechRef = useRef(null);
  const ttsRef = useRef(null);
  // Remembers whether the mic was on before a warning paused it.
  const micWasOnRef = useRef(true);

  // Mic + audio control surface the proctoring hook drives on warning / resume /
  // terminate, without it knowing about speech or TTS internals.
  const media = {
    pause: () => {
      const sp = speechRef.current;
      micWasOnRef.current = sp.micOnRef.current;
      sp.micOnRef.current = false; // stops the recognition auto-restart loop
      sp.stopMic();
      ttsRef.current.stopAudio();
    },
    resume: () => {
      const sp = speechRef.current;
      sp.micOnRef.current = micWasOnRef.current;
      if (sp.micOnRef.current) sp.startMic();
    },
    stop: () => {
      const sp = speechRef.current;
      sp.stopMic();
      sp.micOnRef.current = false;
      ttsRef.current.stopAudio();
    },
  };

  const proctoring = useInterviewProctoring({
    interviewId,
    rootRef,
    onFinish,
    media,
  });
  const {
    hasStarted,
    calibrating,
    warning,
    cameraToast,
    isStarting,
    camError,
    startInterview,
    resumeAfterWarning,
    isFullscreen,
    camVideoRef,
    camStatus,
    camMetricsRef,
  } = proctoring;

  // TTS mutes the mic while the AI speaks, then restores the user's choice.
  const tts = useTextToSpeech({
    onStart: () => speechRef.current?.stopMic(),
    onEnd: () => {
      const sp = speechRef.current;
      if (sp?.micOnRef.current) sp.startMic();
    },
  });

  const speech = useDeepgramSpeech({
    enabled: hasStarted,
    isSpeakingRef: tts.isSpeakingRef,
    onActivity: () => orbRef.current?.bump(),
  });

  const flow = useInterviewFlow({
    interviewData,
    enabled: hasStarted,
    paused: !!warning,
    speakText: tts.speakText,
    speech,
    onFinish,
  });

  // Publish the latest hook APIs for the cross-hook callbacks above.
  speechRef.current = speech;
  ttsRef.current = tts;

  // ===================== CALIBRATION =====================
  if (calibrating) {
    return <CalibrationScreen rootRef={rootRef} camVideoRef={camVideoRef} />;
  }

  // ===================== PRE-START GATE =====================
  if (!hasStarted) {
    return (
      <InterviewStartScreen
        rootRef={rootRef}
        camError={camError}
        isStarting={isStarting}
        onStart={startInterview}
      />
    );
  }

  // ===================== INTERVIEW =====================
  return (
    <div ref={rootRef} className='relative h-screen overflow-hidden' style={{ background: '#080808', color: '#f4f4f5' }}>
      <AnimatedBackground animated={false} />

      {warning && (
        <WarningOverlay warning={warning} isFullscreen={isFullscreen} onResume={resumeAfterWarning} />
      )}

      {cameraToast && <CameraToast toast={cameraToast} />}

      {SHOW_PROCTOR_DEBUG && (
        <ProctorDebugOverlay metricsRef={camMetricsRef} camStatus={camStatus} />
      )}

      <SelfViewPreview camVideoRef={camVideoRef} camStatus={camStatus} />

      <div className='relative z-10 h-screen overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_280px]'>
        <InterviewStage
          orbRef={orbRef}
          isSpeakingRef={tts.isSpeakingRef}
          isAIPlaying={tts.isSpeaking}
          isIntroPhase={flow.isIntroPhase}
          currentIndex={flow.currentIndex}
          questionsLength={flow.questions.length}
          currentQuestion={flow.currentQuestion}
          subtitle={tts.subtitle}
          micError={speech.micError}
          interimText={speech.interimText}
          isMicOn={speech.isMicOn}
          timeLeft={flow.timeLeft}
          answer={speech.answer}
          setAnswer={speech.setAnswer}
          toggleMic={speech.toggleMic}
          submitAnswer={flow.submitAnswer}
          isSubmitting={flow.isSubmitting}
          isLast={flow.isLast}
        />

        <ProgressSidebar questions={flow.questions} currentIndex={flow.currentIndex} />
      </div>
    </div>
  );
}

export default Step2Interview
