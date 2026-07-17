/**
 * FloatingButton — fixed bottom-right chat trigger button
 */
import React from 'react'

export default function FloatingButton({ isOpen, onClick }) {
  return (
    <button
      className={`cb-float-btn ${isOpen ? 'cb-float-btn--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open AI assistant'}
      title={isOpen ? 'Close chat' : 'Ask AI Assistant'}
    >
      <span className="cb-float-icon">
        {isOpen ? '✕' : '🤖'}
      </span>
      {!isOpen && <span className="cb-float-label">AI Help</span>}
    </button>
  )
}
