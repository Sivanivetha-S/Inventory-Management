/**
 * Gemini AI Service for Smart Inventory Chatbot
 * Uses Google Gemini 2.5 Flash API
 *
 * Exports:
 *   sendToGemini(history, message)                    — pure AI (existing)
 *   sendToGeminiWithContext(history, message, context) — AI with live DB data
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

// ── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are the AI Assistant for the Smart Inventory Loss Prevention System.
Your primary responsibility is to assist Owners and Suppliers with inventory management.

LANGUAGE RULES:
1. Automatically detect the language used by the user.
2. If the user asks in Tamil, reply completely in Tamil.
3. If the user asks in English, reply completely in English.
4. If the user asks in Tanglish (Tamil written in English), reply in Tanglish.
5. Never translate unless the user explicitly requests it.
6. Always answer in the same language used by the user.

YOU CAN ANSWER QUESTIONS RELATED TO:
• Product Availability
• Product Details
• Inventory Status
• Supplier Information
• Order Status
• Sales Reports
• Low Stock Alerts
• Expiry Alerts
• AI Recommendations
• Billing Help

RULES FOR INFORMATION RETRIEVAL:
- If the question requires database information, first retrieve the required data from the database and then generate the response.
- If the question is general knowledge, answer naturally.
- Keep answers friendly, professional, clear, and concise.
- Use bullet points for lists.
- Use emojis where appropriate for readability.
- When real data is provided in the context, use it in your answer — do not make up numbers.`

/**
 * Send message to Gemini and get response
 * @param {Array} history - Last 10 messages [{role, parts}]
 * @param {string} userMessage - Current user message
 * @returns {Promise<string>} - AI response text
 */
export async function sendToGemini(history, userMessage) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.')
  }

  // Build contents array — include system instruction as first user turn
  const contents = [
    {
      role: 'user',
      parts: [{ text: `[SYSTEM INSTRUCTION]\n${SYSTEM_INSTRUCTION}\n\n[USER MESSAGE]\n${userMessage}` }]
    }
  ]

  // Add conversation history (skip first if it's a repeat)
  if (history.length > 0) {
    // Rebuild with history for context
    const historyContents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }))

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        ...historyContents,
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ]
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err?.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response from Gemini')
    return text
  }

  // First message — simple request
  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  }

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err?.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')
  return text
}

/**
 * Send message to Gemini WITH injected database context.
 * Used for demand forecasting, sales analysis, product descriptions, etc.
 *
 * @param {Array}  history    - conversation history
 * @param {string} userMessage - what the user asked
 * @param {string} dbContext  - real data from the database formatted as text
 * @returns {Promise<string>}
 */
export async function sendToGeminiWithContext(history, userMessage, dbContext) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.')
  }

  const contextualPrompt = dbContext
    ? `The following is LIVE data from the shop's database. Use it to answer accurately:\n\n${dbContext}\n\nUser question: ${userMessage}`
    : userMessage

  const historyContents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }))

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      ...historyContents,
      { role: 'user', parts: [{ text: contextualPrompt }] }
    ],
    generationConfig: {
      temperature: 0.65,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ]
  }

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err?.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')
  return text
}

/**
 * Generate a professional product description using Gemini AI.
 * Uses category-specific instruction inserts.
 */
export async function generateProductDescription({ productName, brand, category, mfd, expiry }) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.')
  }

  let categoryRule = "";
  const cat = category ? category.trim().toLowerCase() : "";
  if (cat.includes("medicine")) {
    categoryRule = "As this is a Medicine, include usage, dosage note (general only), storage instructions, and expiry importance.";
  } else if (cat.includes("food") || cat.includes("beverage")) {
    categoryRule = "As this is Food & Beverages, include ingredients (generic if unknown), storage instructions, freshness, and usage.";
  } else if (cat.includes("cosmetic")) {
    categoryRule = "As this is a Cosmetic, include benefits, storage instructions, and precautions.";
  } else if (cat.includes("electronic")) {
    categoryRule = "As this is an Electronic product, include features and usage.";
  } else if (cat.includes("clothing") || cat.includes("dress")) {
    categoryRule = "As this is Clothing/Dress, include material (if available), usage, and washing instructions.";
  } else if (cat.includes("plastic")) {
    categoryRule = "As this is a Plastic Product, include usage, durability, and maintenance.";
  } else if (cat.includes("box")) {
    categoryRule = "As this is a Box product, include material, dimensions (if available), and recommended usage.";
  } else {
    categoryRule = "Generate an appropriate professional description based on the product category.";
  }

  const systemPrompt = `You are a professional product copywriting assistant. Generate a high-quality product description following these requirements:
- The description must include: Product Overview, Key Features, Common Uses, Storage Instructions (if applicable), and Safety Information (if applicable).
- Keep the length strictly between 80 and 150 words.
- Use professional, customer-friendly language.
- ${categoryRule}`;

  const promptText = `Generate a professional product description for the following product.

Product Name: ${productName || "Unknown"}
Brand: ${brand || "Unknown"}
Category: ${category || "Unknown"}
Manufacturing Date: ${mfd || "N/A"}
Expiry Date: ${expiry || "N/A"}

Generate a clear, professional, and customer-friendly description including product overview, key features, common uses, and storage instructions (if applicable). Do not invent false claims or medical advice. Keep the description between 80 and 150 words.`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 512
    }
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text.trim();
}

export async function generateProductAIFeatures({ productName, brand, category }) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.')
  }

  const systemPrompt = `You are a product information specialist. Return a valid JSON object (and nothing else) with these exact keys: "description", "storageInstructions", "inventoryCategory", and "tags".
- "description": A customer-friendly overview, 20-50 words.
- "storageInstructions": Storage instructions (e.g. Keep in cool dry place, refrigerate after opening, etc.), 5-15 words.
- "inventoryCategory": Refined inventory categorization (e.g. Frozen Foods, Fresh Produce, Beverages, etc.).
- "tags": An array of 3 to 5 lowercase strings for tagging.`;

  const promptText = `Generate AI attributes for:
Product Name: ${productName}
Brand: ${brand || 'Generic'}
Category: ${category}

Return ONLY the raw JSON object. Do not include markdown code block syntax (like \`\`\`json).`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.5,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return JSON.parse(text.trim());
}
