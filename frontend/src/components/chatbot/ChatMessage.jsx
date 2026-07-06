/**
 * ChatMessage — renders a single chat bubble with copy button
 * Supports basic markdown: **bold**, bullet points, newlines
 */
import React, { useState } from 'react'
import { formatTime } from '../../utils/chatHistory'

function parseText(text) {
  // Convert **bold** to <strong>, preserve newlines, handle bullet points
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold
    const parts = line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    )
    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

export default function ChatMessage({ message, onRegenerate, isLast }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className={`cb-msg ${isUser ? 'cb-msg--user' : 'cb-msg--ai'}`}>
      {!isUser && <div className="cb-avatar">🤖</div>}

      <div className="cb-bubble-wrap">
        <div className="cb-bubble">
          <div className="cb-text">{parseText(message.text)}</div>
        </div>

        <div className="cb-meta">
          <span className="cb-time">{formatTime(message.timestamp)}</span>
          <div className="cb-actions">
            <button
              className="cb-action-btn"
              onClick={handleCopy}
              title="Copy message"
            >
              {copied ? '✓' : '📋'}
            </button>
            {!isUser && isLast && onRegenerate && (
              <button
                className="cb-action-btn"
                onClick={onRegenerate}
                title="Regenerate response"
              >
                🔄
              </button>
            )}
          </div>
        </div>
      </div>

      {isUser && <div className="cb-avatar cb-avatar--user">👤</div>}
    </div>
  )
}
