/**
 * useChat — AI Smart Inventory Assistant Orchestrator
 *
 * Pipeline:
 *  1. Receive message (typed or voice)
 *  2. Classify intent via intentRouter
 *  3a. DB intents  → call inventoryAPI → instant formatted response
 *  3b. AI intents  → call geminiService (with optional DB context injected)
 *  4. Render in chat + optionally speak via TTS
 *
 * Backwards-compatible: LandingPage (unauthenticated) still gets pure Gemini.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { sendToGemini, sendToGeminiWithContext } from '../services/geminiService'
import { addToHistory, userMessage, assistantMessage } from '../utils/chatHistory'
import { classifyIntent, INTENTS } from '../services/intentRouter'
import { chatbotAPI } from '../services/api'
import {
  getInventorySummary,
  getLowStockSummary,
  getOutOfStockSummary,
  searchProduct,
  getTodaysSales,
  getWeeklySales,
  getMonthlySales,
  getTopProducts,
  getLeastProducts,
  getExpiringProducts,
  getTheftAlerts,
  getDamageRecords,
  getDemandForecastData,
  getPendingRequests,
  getNotificationsSummary,
  getCustomersSummary,
  getHelpText,
} from '../services/inventoryAPI'

const AI_SERVICE_FALLBACK = 'The AI service is temporarily busy. Please try again shortly. Live inventory and report questions remain available.'

function isAiProviderFailure(responseText) {
  return /api call failed|generative(language)?\.googleapis\.com|model is currently experiencing high demand|\b503\b/i.test(responseText || '')
}

// ── Welcome messages ──────────────────────────────────────────────────────────
const WELCOME_AUTHED = `👋 Hello! I'm your **Smart Inventory AI Assistant**.

I can answer questions using **live data** from your database.

Try asking:
• "Show low stock products"
• "What are today's sales?"
• "Which products are expiring?"
• "Predict which items will run out soon"

🎤 You can also click the **microphone** to speak your question!`

const WELCOME_PUBLIC = `👋 Hello! Welcome to **Smart Inventory Theft Detection and Billing System**.

I can help you understand how this application works. Ask me anything!`

// ── Demand forecast context builder ──────────────────────────────────────────
async function buildForecastContext(userMsg) {
  const forecastData = await getDemandForecastData()
  if (!forecastData) return null

  const { forecasts, topSellers } = forecastData

  const critical = forecasts.filter(f => f.daysLeft !== null && f.daysLeft <= 7)
  const warning  = forecasts.filter(f => f.daysLeft !== null && f.daysLeft > 7 && f.daysLeft <= 14)
  const safe     = forecasts.filter(f => f.daysLeft === null || f.daysLeft > 14)

  const lines = [
    '=== LIVE INVENTORY FORECAST DATA ===',
    '',
    'Products by estimated days until out-of-stock (based on 30-day sales velocity):',
    '',
  ]

  if (critical.length) {
    lines.push('CRITICAL (will run out within 7 days):')
    critical.forEach(f =>
      lines.push(
        `  - ${f.name}: ${f.stock} units left, sells ~${f.dailyVelocity}/day, ~${f.daysLeft} days left, reorder: ${f.reorderQty ?? 'N/A'} units`
      )
    )
    lines.push('')
  }

  if (warning.length) {
    lines.push('WARNING (7-14 days remaining):')
    warning.forEach(f =>
      lines.push(
        `  - ${f.name}: ${f.stock} units left, sells ~${f.dailyVelocity}/day, ~${f.daysLeft} days left, reorder: ${f.reorderQty ?? 'N/A'} units`
      )
    )
    lines.push('')
  }

  if (safe.length) {
    lines.push('ADEQUATE STOCK (>14 days or not actively sold):')
    safe.slice(0, 5).forEach(f =>
      lines.push(`  - ${f.name}: ${f.stock} units`)
    )
    lines.push('')
  }

  lines.push('Top 30-day sellers:', ...topSellers.slice(0, 5).map(p =>
    `  - ${p.name}: ${p.quantitySold} units sold`
  ))

  return lines.join('\n')
}

// ── Product description context builder ───────────────────────────────────────
function buildDescriptionContext(productName) {
  return `Generate a professional product description for: "${productName}"

Include:
1. A 1-2 sentence description of what it is and its primary use
2. Key features or benefits (2-3 bullet points)
3. Usage instructions (brief)
4. Storage instructions (if applicable)

Keep it concise, professional, and suitable for a retail inventory system.
Format with clear sections. The owner can edit this before saving.`
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useChat({ isAuthenticated = false } = {}) {
  const WELCOME = isAuthenticated ? WELCOME_AUTHED : WELCOME_PUBLIC

  const [messages,      setMessages]      = useState([assistantMessage(WELCOME)])
  const [input,         setInput]         = useState('')
  const [isTyping,      setIsTyping]      = useState(false)
  const [error,         setError]         = useState(null)
  const [lastUserMsgId, setLastUserMsgId] = useState(null)
  const [lastIntent,    setLastIntent]    = useState(null)

  const historyRef = useRef([])
  const bottomRef  = useRef(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // ── Core send pipeline ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    setError(null)

    const uMsg = userMessage(trimmed)
    setMessages(prev => [...prev, uMsg])
    setLastUserMsgId(uMsg.id)
    setInput('')
    setIsTyping(true)

    let responseText = ''
    let intent = INTENTS.AI_GENERAL

    try {
      // ── Step 1: classify intent ─────────────────────────────────────────
      const classified = classifyIntent(trimmed, isAuthenticated)
      intent = classified.intent
      setLastIntent(intent)

      // ── Step 2: route to DB or AI ───────────────────────────────────────
      if (!isAuthenticated) {
        // Public chatbot: pure Gemini always
        responseText = await sendToGemini(historyRef.current, trimmed)
      } else {
        // Authenticated chatbot: ALWAYS call Spring Boot backend ChatbotController
        const res = await chatbotAPI.chat(trimmed, historyRef.current)
        responseText = res.data?.data?.response || res.data?.response || ''
        if (!responseText || isAiProviderFailure(responseText)) {
          responseText = AI_SERVICE_FALLBACK
        }
      }

      // ── Update history ─────────────────────────────────────────────────
      historyRef.current = addToHistory(historyRef.current, { role: 'user',      text: trimmed })
      historyRef.current = addToHistory(historyRef.current, { role: 'assistant', text: responseText })

      setMessages(prev => [...prev, assistantMessage(responseText)])

    } catch (err) {
      err.message = AI_SERVICE_FALLBACK
      setError(err.message)
      setMessages(prev => [...prev, assistantMessage(
        `⚠️ Sorry, I encountered an error: ${err.message}\n\nPlease try again.`
      )])
    } finally {
      setIsTyping(false)
    }
  }, [isTyping, isAuthenticated])

  // ── Regenerate last response ──────────────────────────────────────────────
  const regenerate = useCallback(async () => {
    if (isTyping || historyRef.current.length < 2) return

    const lastUserMsg = [...historyRef.current].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return

    setMessages(prev => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') { copy.splice(i, 1); break }
      }
      return copy
    })

    historyRef.current = historyRef.current.slice(0, -2)
    setIsTyping(true)
    setError(null)

    try {
      let responseText
      if (isAuthenticated) {
        const response = await chatbotAPI.chat(lastUserMsg.text, historyRef.current)
        responseText = response.data?.data?.response || response.data?.response || AI_SERVICE_FALLBACK
        if (isAiProviderFailure(responseText)) responseText = AI_SERVICE_FALLBACK
      } else {
        responseText = await sendToGemini(historyRef.current, lastUserMsg.text)
      }
      historyRef.current = addToHistory(historyRef.current, { role: 'user',      text: lastUserMsg.text })
      historyRef.current = addToHistory(historyRef.current, { role: 'assistant', text: responseText })
      setMessages(prev => [...prev, assistantMessage(responseText)])
    } catch (err) {
      err.message = AI_SERVICE_FALLBACK
      setError(err.message)
      setMessages(prev => [...prev, assistantMessage(`⚠️ Error: ${err.message}`)])
    } finally {
      setIsTyping(false)
    }
  }, [isTyping, isAuthenticated])

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = useCallback(() => {
    setMessages([assistantMessage(WELCOME)])
    historyRef.current = []
    setInput('')
    setError(null)
    setIsTyping(false)
    setLastIntent(null)
  }, [WELCOME])

  return {
    messages,
    input, setInput,
    isTyping,
    error,
    lastUserMsgId,
    lastIntent,
    bottomRef,
    sendMessage,
    regenerate,
    clearChat,
  }
}
