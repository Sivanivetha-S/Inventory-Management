/**
 * FloatingButton — squircle app icon style
 * Teal-to-cyan gradient, polygon overlay, long diagonal shadow
 * White robot with green eyes + antenna centered inside
 */
import React from 'react'

export default function FloatingButton({ isOpen, onClick }) {
  return (
    <button
      className={`cb-float-btn ${isOpen ? 'cb-float-btn--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open AI assistant'}
      title={isOpen ? 'Close' : 'AI Assistant'}
    >
      {isOpen ? (
        /* Close X */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg
          width="54"
          height="54"
          viewBox="0 0 54 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Main teal-to-cyan gradient */}
            <linearGradient id="sq-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#26C6DA" />
              <stop offset="100%" stopColor="#00897B" />
            </linearGradient>

            {/* Lighter overlay gradient for the polygon shine */}
            <linearGradient id="sq-poly" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
            </linearGradient>

            {/* Clip to squircle shape */}
            <clipPath id="sq-clip">
              <rect x="0" y="0" width="54" height="54" rx="16" ry="16" />
            </clipPath>
          </defs>

          {/* ── Background squircle ── */}
          <rect x="0" y="0" width="54" height="54" rx="16" ry="16"
            fill="url(#sq-bg)" />

          {/* ── Polygon overlay — subtle diamond/gem shape at bottom ── */}
          <g clipPath="url(#sq-clip)">
            <polygon
              points="27,54 54,30 54,54"
              fill="url(#sq-poly)"
            />
            <polygon
              points="0,40 27,54 0,54"
              fill="url(#sq-poly)"
            />
          </g>

          {/* ── Robot — shifted down to visually center in frame ── */}

          {/* Antenna stem */}
          <line x1="27" y1="10" x2="27" y2="17"
            stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          {/* Antenna ball */}
          <circle cx="27" cy="9.5" r="2.8" fill="white" />

          {/* Head — white rounded rect */}
          <rect x="12" y="17" width="30" height="22" rx="11" fill="white" />

          {/* Left eye — layered circles */}
          <circle cx="20.5" cy="28" r="5.5" fill="#b2dfdb" />
          <circle cx="20.5" cy="28" r="3.8" fill="#26a69a" />
          <circle cx="20.5" cy="28" r="1.8" fill="#004d40" />
          <circle cx="19"   cy="26.5" r="1.1" fill="white" opacity="0.9" />

          {/* Right eye — layered circles */}
          <circle cx="33.5" cy="28" r="5.5" fill="#b2dfdb" />
          <circle cx="33.5" cy="28" r="3.8" fill="#26a69a" />
          <circle cx="33.5" cy="28" r="1.8" fill="#004d40" />
          <circle cx="32"   cy="26.5" r="1.1" fill="white" opacity="0.9" />

          {/* Smile */}
          <path d="M20 35 Q27 40 34 35"
            stroke="#80cbc4" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      )}
    </button>
  )
}
