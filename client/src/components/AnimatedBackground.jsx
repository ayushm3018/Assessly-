import React from 'react'

/**
 * Fixed mesh-gradient backdrop used behind every screen.
 * Conic sheen + three parallax blobs in indigo/silver, with a vignette on top.
 * Purely decorative (pointer-events:none).
 *
 * `animated` defaults to FALSE. When the blurred layers drift/rotate, every
 * `backdrop-filter` glass element on top has to re-blur the moving background
 * each frame — that was the global page lag. Static, the blurred layers rasterize
 * once and the glass blur caches, so pages stay smooth. The look is identical to
 * a frozen frame. Pass `animated` to bring the drift back if you ever want it.
 */
function AnimatedBackground({ animated = false }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
      aria-hidden="true"
    >
      {/* slow-rotating metallic conic sheen for depth */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '130vmax',
          height: '130vmax',
          margin: '-65vmax 0 0 -65vmax',
          background:
            'conic-gradient(from 0deg, rgba(79,70,229,0.14), rgba(192,192,192,0.06), transparent 28%, rgba(120,118,235,0.12) 52%, transparent 72%, rgba(192,192,192,0.07) 88%, rgba(79,70,229,0.14))',
          filter: 'blur(70px)',
          animation: animated ? 'bgSpin 44s linear infinite' : undefined,
        }}
      />
      {/* drifting parallax blobs */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-12%',
          width: '58vw',
          height: '58vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(79,70,229,0.34), transparent 62%)',
          filter: 'blur(55px)',
          animation: animated ? 'blobA 19s ease-in-out infinite' : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-22%',
          right: '-10%',
          width: '52vw',
          height: '52vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(192,192,192,0.15), transparent 62%)',
          filter: 'blur(55px)',
          animation: animated ? 'blobB 24s ease-in-out infinite' : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '24%',
          right: '18%',
          width: '44vw',
          height: '44vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(132,122,236,0.22), transparent 64%)',
          filter: 'blur(60px)',
          animation: animated ? 'blobC 16s ease-in-out infinite' : undefined,
        }}
      />
      {/* vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, transparent 45%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )
}

export default AnimatedBackground
