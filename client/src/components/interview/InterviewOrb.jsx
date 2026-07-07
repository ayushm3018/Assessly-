import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Reactive (Siri-style) glowing orb. Driven by speech activity and applied
 * straight to the DOM in a rAF loop so it never triggers React re-renders.
 *
 * While the AI speaks (`isSpeakingRef.current`): a lively pulse. While listening:
 * the orb glows in proportion to recent speech activity (bumped via the imperative
 * `bump()` handle from the speech hook) and fades when you're silent.
 */
const InterviewOrb = forwardRef(function InterviewOrb({ isSpeakingRef }, ref) {
  const coreRef = useRef(null);
  const haloRef = useRef(null);
  const levelRef = useRef(0); // smoothed displayed loudness 0..1
  const voiceLevelRef = useRef(0); // spikes when the user speaks, then decays
  const rafRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      bump: () => {
        voiceLevelRef.current = 1;
      },
    }),
    []
  );

  useEffect(() => {
    const tick = () => {
      let target = 0;
      if (isSpeakingRef?.current) {
        const t = performance.now() / 1000;
        target = Math.min(
          1,
          0.32 + 0.3 * Math.abs(Math.sin(t * 6)) + 0.16 * Math.abs(Math.sin(t * 10.3 + 1))
        );
      } else {
        target = voiceLevelRef.current;
      }
      voiceLevelRef.current *= 0.9; // decay speech spikes
      levelRef.current += (target - levelRef.current) * 0.2;
      const l = levelRef.current;
      if (coreRef.current) coreRef.current.style.transform = `scale(${1 + l * 0.2})`;
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${1 + l * 0.8})`;
        haloRef.current.style.opacity = `${0.3 + l * 0.6}`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpeakingRef]);

  return (
    <div className='relative flex items-center justify-center' style={{ width: 200, height: 200 }}>
      <div ref={haloRef} className='absolute rounded-full'
        style={{ width: 170, height: 170, background: 'radial-gradient(circle, rgba(196,200,240,0.6), rgba(120,118,235,0.20) 55%, transparent 72%)', filter: 'blur(30px)', willChange: 'transform, opacity' }}></div>
      <div className='absolute rounded-full'
        style={{ width: 150, height: 150, background: 'conic-gradient(from 0deg, rgba(232,232,232,0.5), rgba(120,118,235,0.35), rgba(160,160,170,0.18), rgba(232,232,232,0.5))', filter: 'blur(10px)', animation: 'spinSlow 9s linear infinite', opacity: 0.6 }}></div>
      <div style={{ animation: 'orbBreath 4.2s ease-in-out infinite' }}>
        <div ref={coreRef} className='relative rounded-full'
          style={{ width: 124, height: 124, background: 'radial-gradient(circle at 38% 30%, #fbfbfe, #c4c6e2 42%, #8281c4 78%, #5b5aa6 100%)', boxShadow: 'inset 0 0 30px rgba(255,255,255,0.55), inset 0 -16px 32px rgba(70,68,140,0.5), 0 0 50px rgba(150,150,220,0.4)', willChange: 'transform' }}>
          <div className='absolute rounded-full' style={{ top: '15%', left: '22%', width: '42%', height: '30%', background: 'radial-gradient(circle, rgba(255,255,255,0.95), transparent 70%)', filter: 'blur(3px)' }}></div>
        </div>
      </div>
    </div>
  );
});

export default InterviewOrb;
