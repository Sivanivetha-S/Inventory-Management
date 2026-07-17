/**
 * useSpeech — Voice Input (Speech-to-Text) + Text-to-Speech
 *
 * Uses the browser-native Web Speech API:
 *   - SpeechRecognition  (STT) — mic input
 *   - SpeechSynthesis    (TTS) — read responses aloud
 *
 * FIX: Callbacks stored in refs so the recognition object
 * is created ONCE and never torn down due to prop changes.
 * This was the root cause of the mic not working.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

// Detect browser support at module load (before any hook call)
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null

const synth =
  typeof window !== 'undefined' ? (window.speechSynthesis || null) : null

export function useSpeech({ onTranscript, onError }) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [ttsEnabled,  setTtsEnabled]  = useState(false)

  // ── Store latest callbacks in refs — NEVER put them in a dep array ─────────
  // This is the standard React pattern for stable callbacks in effects.
  // Without this, every render creates new function refs, which re-ran
  // the useEffect, aborting the live recognition instance every render.
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef      = useRef(onError)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onErrorRef.current      = onError      }, [onError])

  // Stable ref to the SpeechRecognition instance (created once)
  const recognitionRef = useRef(null)

  // ── Initialise recognition ONCE — empty dep array [] ──────────────────────
  useEffect(() => {
    if (!SpeechRecognitionAPI) return

    const rec = new SpeechRecognitionAPI()
    rec.lang            = 'en-IN'  // Indian English; browser falls back to en
    rec.interimResults  = false    // only final results
    rec.maxAlternatives = 1
    rec.continuous      = false    // stop after one utterance

    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) {
        onTranscriptRef.current?.(transcript)
      }
      setIsListening(false)
    }

    rec.onerror = (event) => {
      // 'aborted' and 'no-speech' are normal — don't surface as errors
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onErrorRef.current?.(`Mic error: ${event.error}`)
      }
      setIsListening(false)
    }

    rec.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = rec

    // Cleanup: abort on unmount only
    return () => {
      try { rec.abort() } catch (_) {}
    }
  }, []) // ← empty array: runs ONCE, never re-runs

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return

    try {
      // Cancel TTS before speaking
      if (synth?.speaking) synth.cancel()

      // Chrome throws if you call start() on an already-started recognition.
      // Create a fresh instance each time to avoid InvalidStateError.
      const fresh = new SpeechRecognitionAPI()
      fresh.lang            = 'en-IN'
      fresh.interimResults  = false
      fresh.maxAlternatives = 1
      fresh.continuous      = false

      fresh.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim()
        if (transcript) onTranscriptRef.current?.(transcript)
        setIsListening(false)
      }

      fresh.onerror = (event) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          onErrorRef.current?.(`Mic error: ${event.error}`)
        }
        setIsListening(false)
      }

      fresh.onend = () => setIsListening(false)

      recognitionRef.current = fresh
      fresh.start()
      setIsListening(true)
    } catch (err) {
      setIsListening(false)
      onErrorRef.current?.('Could not start microphone: ' + err.message)
    }
  }, [])  // stable — no deps needed because refs are used

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop() } catch (_) {}
    setIsListening(false)
  }, [])

  // ── Toggle mic ────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) stopListening()
    else startListening()
  }, [isListening, startListening, stopListening])

  // ── Speak text aloud ──────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!synth || !ttsEnabled) return

    synth.cancel()

    // Strip markdown / emojis for cleaner speech output
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
      .replace(/[📊📦⚠️🔮💡🎯✅❌🏆📉📋🔔👥💰🔍🛠️]/g, '')
      .replace(/•/g, ',')
      .replace(/─+/g, '')
      .trim()

    if (!clean) return

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang   = 'en-IN'
    utterance.rate   = 1.0
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    // Pick the best available English voice
    const voices = synth.getVoices()
    const preferred =
      voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      null
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synth.speak(utterance)
    setIsSpeaking(true)
  }, [ttsEnabled])

  // ── Stop speaking ─────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    synth?.cancel()
    setIsSpeaking(false)
  }, [])

  // ── Toggle TTS ────────────────────────────────────────────────────────────
  const toggleTts = useCallback(() => {
    if (synth?.speaking) synth.cancel()
    setTtsEnabled(prev => !prev)
  }, [])

  return {
    isListening,
    isSpeaking,
    ttsEnabled,
    sttSupported: !!SpeechRecognitionAPI,
    ttsSupported: !!synth,
    toggleListening,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleTts,
  }
}
