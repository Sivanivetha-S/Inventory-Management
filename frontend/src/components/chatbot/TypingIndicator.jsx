/**
 * TypingIndicator — animated dots shown when AI is generating
 */
import React from 'react'

export default function TypingIndicator() {
  return (
    <div className="cb-msg cb-msg--ai cb-typing-wrap">
      <div className="cb-avatar">🤖</div>
      <div className="cb-typing">
        <span className="cb-dot" />
        <span className="cb-dot" />
        <span className="cb-dot" />
      </div>
    </div>
  )
}
