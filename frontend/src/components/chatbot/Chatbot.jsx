/**
 * Chatbot — main container component
 * Renders floating button + chat window
 * Only added to LandingPage — does not touch any existing logic
 */
import React, { useState, useRef, useEffect } from 'react'
import './Chatbot.css'
import FloatingButton  from './FloatingButton'
import ChatMessage     from './ChatMessage'
import TypingIndicator from './TypingIndicator'
import { useChat }     from '../../hooks/useChat'

const SUGGESTIONS = [
  'How do I register?',
  'How does billing work?',
  'How is theft detected?',
  'How do discounts work?',
]

export default function Chatbot() {
  const [isOpen,   setIsOpen]   = useState(false)
  const [closing,  setClosing]  = useState(false)

  const {
    messages, input, setInput,
    isTyping, lastUserMsgId,
    bottomRef, sendMessage,
    regenerate, clearChat
  } = useChat()

  const textareaRef = useRef(null)

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 320)
    }
  }, [isOpen])

  // Open chat
  const handleOpen = () => {
    setClosing(false)
    setIsOpen(true)
  }

  // Close with animation
  const handleClose = () => {
    setClosing(true)
    setTimeout(() => { setIsOpen(false); setClosing(false) }, 220)
  }

  const handleToggle = () => isOpen ? handleClose() : handleOpen()

  // Handle key press in textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (input.trim()) sendMessage(input)
  }

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 90) + 'px'
    }
  }

  return (
    <>
      {/* ── Floating trigger button ── */}
      <FloatingButton isOpen={isOpen} onClick={handleToggle} />

      {/* ── Chat window ── */}
      {isOpen && (
        <div className={`cb-window ${closing ? 'cb-window--closing' : ''}`}>

          {/* Header */}
          <div className="cb-header">
            <div className="cb-header-avatar">🤖</div>
            <div className="cb-header-info">
              <div className="cb-header-name">Smart Inventory AI</div>
              <div className="cb-header-status">
                <span className="cb-status-dot" />
                {isTyping ? 'Typing...' : 'Online · Ask me anything'}
              </div>
            </div>
            <div className="cb-header-actions">
              <button
                className="cb-header-btn"
                onClick={clearChat}
                title="Clear chat"
              >🗑️</button>
              <button
                className="cb-header-btn"
                onClick={handleClose}
                title="Close"
              >✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="cb-messages">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isLast={idx === messages.length - 1}
                onRegenerate={
                  idx === messages.length - 1 && msg.role === 'assistant'
                    ? regenerate
                    : null
                }
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions — only show when no messages sent yet */}
          {messages.length <= 1 && (
            <div className="cb-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="cb-suggestion"
                  onClick={() => sendMessage(s)}
                  disabled={isTyping}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="cb-input-area">
            <textarea
              ref={textareaRef}
              className="cb-input"
              placeholder="Ask about the application… (Enter to send)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              rows={1}
            />
            <button
              className="cb-send-btn"
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              title="Send message"
            >
              ➤
            </button>
          </div>

        </div>
      )}
    </>
  )
}
