/**
 * Chat history utilities
 * Manages last 10 messages for Gemini context window
 */

const MAX_HISTORY = 10

/**
 * Add a message to history and keep only last MAX_HISTORY messages
 * @param {Array} history
 * @param {Object} message - { role: 'user'|'assistant', text: string }
 * @returns {Array} updated history
 */
export function addToHistory(history, message) {
  const updated = [...history, message]
  // Keep only last MAX_HISTORY messages
  return updated.slice(-MAX_HISTORY)
}

/**
 * Create a user message object
 */
export function userMessage(text) {
  return {
    id: Date.now() + Math.random(),
    role: 'user',
    text,
    timestamp: new Date()
  }
}

/**
 * Create an assistant message object
 */
export function assistantMessage(text) {
  return {
    id: Date.now() + Math.random(),
    role: 'assistant',
    text,
    timestamp: new Date()
  }
}

/**
 * Format timestamp for display
 */
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}
