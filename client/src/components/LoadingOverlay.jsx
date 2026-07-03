import React from 'react'

/**
 * Full-screen, game-style loading screen shown while the résumé is analyzed
 * and the interview is generated.
 *
 * Why a full-screen overlay instead of a thin top bar:
 *   - It's opaque, so it hides the animated background entirely — the GPU no
 *     longer has to composite the blurred blobs + backdrop-filter at the same
 *     time as the bar, which is what made the old top bar look laggy.
 *   - The fill is a single transform-only (scaleX) animation on its own layer,
 *     so it stays buttery smooth.
 *
 * `stage` is the human-readable status line ("Analyzing your résumé…").
 */
function LoadingOverlay({ stage = "Loading…" }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        // Opaque backdrop — covers the animated background so nothing competes
        // with the loader for compositing.
        background:
          'radial-gradient(1200px 600px at 50% 35%, #141417 0%, #0a0a0c 55%, #050505 100%)',
      }}
      aria-live="polite"
      aria-busy="true"
    >
      {/* brand wordmark */}
      <div style={{ textAlign: 'center' }}>
        <div
          className="text-metal"
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          Assessly
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(190,190,200,0.55)',
            fontWeight: 600,
          }}
        >
          Preparing your session
        </div>
      </div>

      {/* progress track */}
      <div
        style={{
          width: 'min(420px, 78vw)',
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.07)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* creeping fill — single scaleX transform = smooth, GPU composited */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: 'left center',
            background: 'var(--accent-grad)',
            boxShadow: '0 0 18px rgba(200,200,220,0.55)',
            willChange: 'transform',
            transform: 'translateZ(0) scaleX(0.04)',
            animation: 'loadCreep 11s cubic-bezier(0.16,0.84,0.3,1) forwards',
          }}
        />
      </div>

      {/* live status text */}
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 300,
          color: 'rgba(220,220,228,0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-2)',
            boxShadow: '0 0 10px rgba(200,200,220,0.9)',
            animation: 'idlePulse 1.4s ease-in-out infinite',
          }}
        />
        {stage}
      </div>
    </div>
  )
}

export default LoadingOverlay
