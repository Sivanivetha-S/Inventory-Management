/**
 * useChat hook — manages all chatbot state and logic
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { sendToGemini } from '../services/geminiService'
import { addToHistory, userMessage, assistantMessage } from '../utils/chatHistory'

const WELCOME_MESSAGE = `👋 Hello! Welcome to **Smart Inventory Theft Detection and Billing System**.`

export function useChat() {
  const [messages, setMessages]     = useState([
    assistantMessage(WELCOME_MESSAGE)
  ])
  const [input, setInput]           = useState('')
  const [isTyping, setIsTyping]     = useState(false)
  const [error, setError]           = useState(null)
  const [lastUserMsgId, setLastUserMsgId] = useState(null)

  // History for Gemini context (excludes welcome message)
  const historyRef = useRef([])
  const bottomRef  = useRef(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Send a message
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    setError(null)

    // Add user message to UI
    const uMsg = userMessage(trimmed)
    setMessages(prev => [...prev, uMsg])
    setLastUserMsgId(uMsg.id)
    setInput('')
    setIsTyping(true)

    try {
      // Call Gemini
      const responseText = await sendToGemini(historyRef.current, trimmed)

      // Add to history for next request
      historyRef.current = addToHistory(historyRef.current, { role: 'user',      text: trimmed })
      historyRef.current = addToHistory(historyRef.current, { role: 'assistant', text: responseText })

      // Add assistant message to UI
      setMessages(prev => [...prev, assistantMessage(responseText)])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, assistantMessage(
        `⚠️ Sorry, I encountered an error: ${err.message}\n\nPlease try again.`
      )])
    } finally {
      setIsTyping(false)
    }
  }, [isTyping])

  // Regenerate last response
  const regenerate = useCallback(async () => {
    if (isTyping || historyRef.current.length < 2) return

    // Get last user message
    const lastUserMsg = [...historyRef.current].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return

    // Remove last assistant message from UI
    setMessages(prev => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') { copy.splice(i, 1); break }
      }
      return copy
    })

    // Remove last two entries from history (user + assistant)
    historyRef.current = historyRef.current.slice(0, -2)
    setIsTyping(true)
    setError(null)

    try {
      const responseText = await sendToGemini(historyRef.current, lastUserMsg.text)
      historyRef.current = addToHistory(historyRef.current, { role: 'user',      text: lastUserMsg.text })
      historyRef.current = addToHistory(historyRef.current, { role: 'assistant', text: responseText })
      setMessages(prev => [...prev, assistantMessage(responseText)])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, assistantMessage(`⚠️ Error: ${err.message}`)])
    } finally {
      setIsTyping(false)
    }
  }, [isTyping])

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([assistantMessage(WELCOME_MESSAGE)])
    historyRef.current = []
    setInput('')
    setError(null)
    setIsTyping(false)
  }, [])

  return {
    messages,
    input, setInput,
    isTyping,
    error,
    lastUserMsgId,
    bottomRef,
    sendMessage,
    regenerate,
    clearChat
  }
}
