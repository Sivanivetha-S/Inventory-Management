/**
 * Chatbot — AI Smart Inventory Assistant
 *
 * Extended with:
 *   - Voice input (mic button, Web Speech API via useSpeech)
 *   - Text-to-Speech toggle in header
 *   - Auth-aware: passes isAuthenticated to useChat for live DB queries
 *   - Inventory-specific quick suggestions
 *
 * FIXES applied:
 *   - useAuth() called unconditionally (no try-catch — violates Rules of Hooks)
 *   - onTranscript / onError wrapped in useCallback so useSpeech receives
 *     stable references and its internal dep array stays clean
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import './Chatbot.css'
import FloatingButton  from './FloatingButton'
import ChatMessage     from './ChatMessage'
import TypingIndicator from './TypingIndicator'
import { useChat }     from '../../hooks/useChat'
import { useSpeech }   from '../../hooks/useSpeech'
import { useAuth }     from '../../context/AuthContext'

// ── Quick suggestions (shown before first user message) ───────────────────────
const SUGGESTIONS_AUTHED = [
  'Show low stock products',
  "Today's sales",
  'Theft alerts',
  'Demand forecast',
  'Show expiring products',
  'Show notifications',
]

const SUGGESTIONS_PUBLIC = [
  'How do I register?',
  'How does billing work?',
  'How is theft detected?',
  'How do discounts work?',
]

export default function Chatbot() {
  const [isOpen,  setIsOpen]  = useState(false)
  const [closing, setClosing] = useState(false)

  // ── Auth — called unconditionally (Rules of Hooks) ───────────────────────
  // Both LandingPage and AppLayout sit inside <AuthProvider> in App.jsx,
  // so this is always safe to call. No try-catch needed.
  const { isAuthenticated } = useAuth()

  // ── Chat state ────────────────────────────────────────────────────────────
  const {
    messages, input, setInput,
    isTyping,
    bottomRef, sendMessage,
    regenerate, clearChat,
  } = useChat({ isAuthenticated })

  const textareaRef = useRef(null)

  // ── Stable voice callbacks (useCallback ensures same ref across renders) ──
  // Without useCallback, inline arrow functions create a new reference every
  // render — this was causing the recognition object to be torn down and
  // rebuilt on every keystroke, breaking the mic.
  const handleTranscript = useCallback((transcript) => {
    // Fill the textarea so the user can see what was recognised
    setInput(transcript)
    // Then immediately send it
    sendMessage(transcript)
  }, [setInput, sendMessage])

  const handleVoiceError = useCallback((msg) => {
    console.warn('[Voice]', msg)
  }, [])

  // ── Voice / TTS ──────────────────────────────────────────────────────────
  const {
    isListening, ttsEnabled, sttSupported, ttsSupported,
    toggleListening, speak, toggleTts,
  } = useSpeech({
    onTranscript: handleTranscript,
    onError:      handleVoiceError,
  })

  // Speak new AI responses when TTS is on
  const prevMsgCountRef = useRef(messages.length)
  useEffect(() => {
    if (!ttsEnabled) return
    if (messages.length > prevMsgCountRef.current) {
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant') speak(last.text)
    }
    prevMsgCountRef.current = messages.length
  }, [messages, ttsEnabled, speak])

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 320)
  }, [isOpen])

  // ── Open / Close ─────────────────────────────────────────────────────────
  const handleOpen  = () => { setClosing(false); setIsOpen(true) }
  const handleClose = () => {
    setClosing(true)
    setTimeout(() => { setIsOpen(false); setClosing(false) }, 220)
  }
  const handleToggle = () => isOpen ? handleClose() : handleOpen()

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  const handleSend = () => { if (input.trim()) sendMessage(input) }
  const handleInputChange = (e) => {
    setInput(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 90) + 'px'
    }
  }

  const SUGGESTIONS = isAuthenticated ? SUGGESTIONS_AUTHED : SUGGESTIONS_PUBLIC

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
                {isTyping
                  ? 'Thinking…'
                  : isListening
                  ? '🎤 Listening…'
                  : isAuthenticated
                  ? 'Online · Live data ready'
                  : 'Online · Ask me anything'}
              </div>
            </div>
            <div className="cb-header-actions">
              {/* TTS toggle */}
              {ttsSupported && (
                <button
                  className={`cb-header-btn cb-tts-btn ${ttsEnabled ? 'cb-tts-btn--active' : ''}`}
                  onClick={toggleTts}
                  title={ttsEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                  aria-label="Toggle text-to-speech"
                >
                  {ttsEnabled ? '🔊' : '🔇'}
                </button>
              )}
              <button className="cb-header-btn" onClick={clearChat} title="Clear chat">🗑️</button>
              <button className="cb-header-btn" onClick={handleClose} title="Close">✕</button>
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

          {/* Quick suggestions */}
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

          {/* Listening status bar */}
          {isListening && (
            <div className="cb-voice-status">
              <span className="cb-voice-pulse" />
              Listening… speak now
            </div>
          )}

          {/* Input area */}
          <div className="cb-input-area">
            <textarea
              ref={textareaRef}
              className="cb-input"
              placeholder={
                isAuthenticated
                  ? 'Ask about inventory, sales, stock… (Enter to send)'
                  : 'Ask about the application… (Enter to send)'
              }
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isTyping || isListening}
              rows={1}
            />

            {/* Mic button */}
            {sttSupported && (
              <button
                className={`cb-mic-btn ${isListening ? 'cb-mic-btn--listening' : ''}`}
                onClick={toggleListening}
                disabled={isTyping}
                title={isListening ? 'Stop listening' : 'Speak your question'}
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                {isListening ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8"  y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            )}

            <button
              className="cb-send-btn"
              onClick={handleSend}
              disabled={isTyping || !input.trim() || isListening}
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
