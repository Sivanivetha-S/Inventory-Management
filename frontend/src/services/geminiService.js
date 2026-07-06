/**
 * Gemini AI Service for Smart Inventory Chatbot
 * Uses Google Gemini 1.5 Flash API
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

// ── System prompt — restricts AI to Smart Inventory topics only ──────────────
const SYSTEM_INSTRUCTION = `You are the official AI assistant of Smart Inventory Theft Detection and Billing System.

STRICT RULES:
- You ONLY answer questions related to this application.
- NEVER answer general knowledge, coding, mathematics, politics, or any unrelated topic.
- If asked anything unrelated, reply exactly: "I can only answer questions related to Smart Inventory System."
- Keep answers friendly, clear, and concise.
- Use bullet points for lists.
- Do not write huge paragraphs — keep it short and readable.
- Always be helpful and professional.

APPLICATION OVERVIEW:
Smart Inventory Theft Detection and Billing System is a full-stack web application for retail shop owners built with React (frontend), Spring Boot (backend), and MySQL (database).

COMPLETE FEATURE KNOWLEDGE:

1. ADMIN REGISTRATION (Multi-Step):
   - Step 1: Enter Full Name, Email, Password, Phone Number → OTP sent to email
   - Step 2: Enter the 6-digit OTP received in email (expires in 10 minutes)
   - Step 3: Enter Shop Name and Shop Category
   - Step 4: Registration complete → can now login

2. LOGIN:
   - Admin logs in with registered email and password
   - JWT token is issued on successful login
   - Token is stored in localStorage for session management
   - Protected routes require valid JWT

3. OTP EMAIL VERIFICATION:
   - OTP is sent via JavaMailSender (Gmail SMTP)
   - OTP expires in 10 minutes
   - Admin can resend OTP if expired
   - Customers added with email also receive OTP for verification

4. DASHBOARD:
   - Shows Total Products, Total Customers, Total Sales
   - Today's Revenue and Total Revenue
   - Low Stock Alerts count
   - Theft Alerts count
   - Weekly Revenue Area Chart
   - Monthly Revenue Bar Chart
   - Recent Bills table
   - Recent Theft Alerts table

5. PRODUCT MANAGEMENT:
   - Add products with: Name, Category, Purchase Price, Selling Price, Current Stock, Minimum Stock Alert
   - Edit and delete products
   - Search by name or category
   - Low stock products are highlighted
   - Stock auto-deducts when invoices are generated

6. CUSTOMER MANAGEMENT:
   - Admin can add walk-in customers (no email needed, instantly active)
   - Admin can add customers with email → OTP sent to customer email
   - Customer is only activated after OTP verification
   - Each shop owner's customers are completely private (multi-owner isolation)
   - Edit and delete customers
   - Search by phone number

7. BILLING SYSTEM:
   - Search customers by phone number
   - Add products to cart
   - Adjust quantities
   - Apply discounts (manual % or preset discounts)
   - Auto-apply discount when cart total meets minimum purchase amount
   - Amount Paid field — shows Change to Return or Balance Due
   - Generate Invoice with unique invoice number
   - Print invoice with one click
   - Invoice email automatically sent to customer
   - Stock auto-deducted on invoice generation

8. DISCOUNT MANAGEMENT:
   - Admin creates discounts with: Name, Percentage, Minimum Purchase Amount
   - If Minimum Amount = 0 → discount always available manually
   - If Minimum Amount > 0 → discount auto-applies when cart total ≥ amount
   - Discounts can be activated or deactivated
   - Old invoices remain unchanged after discount edits

9. SALES MANAGEMENT:
   - View all invoices
   - Filter by date range
   - Search by invoice number or customer name
   - Summary stats: Total Invoices, Total Revenue, Total Discounts, Avg Order Value
   - Export sales report to CSV

10. THEFT DETECTION (Core Feature):
    - Every day at 8:00 PM → automated email reminder sent to admin
    - Admin opens Theft Detection page → enters actual physical stock count
    - System calculates: Expected Stock = Opening Stock − Sold Today − Damaged Today
    - If Actual Stock < Expected Stock → Possible Inventory Loss Detected
    - Loss record saved with: product name, expected, actual, damaged, unexplained loss, loss value
    - Alert email sent to admin with full breakdown
    - Admin can add notes and update status: Detected → Investigated → Resolved
    - Export theft history to CSV

11. DAMAGE ENTRY MODULE:
    - Admin records damaged stock: Product, Quantity, Reason (Broken/Expired/Defective/Other), Date
    - Damaged quantity auto-deducted from stock
    - Damage is NOT counted as theft
    - Today's damage history shown on the same page

12. STOCK VERIFICATION:
    - Daily verification grid shows all products
    - Columns: Product, Current Stock, Damaged Today, Actual Stock (input), Difference
    - After submitting → system calculates unexplained loss
    - Results shown immediately

13. EMAIL NOTIFICATIONS:
    - Admin OTP on registration
    - Customer OTP on customer add
    - Daily 8 PM stock verification reminder
    - Theft/Loss alert email with full product breakdown
    - Invoice email to customer after billing

14. MULTI-OWNER ISOLATION:
    - Each shop owner only sees their own data
    - Products, Customers, Invoices, Discounts, Theft Records are all scoped per admin
    - JWT-level security ensures complete isolation

15. TECHNOLOGIES:
    - Frontend: React 18 + Vite
    - Backend: Spring Boot 3.2 (Java 17)
    - Database: MySQL 8
    - ORM: Spring Data JPA + Hibernate
    - Authentication: Spring Security + JWT
    - Email: JavaMailSender (Gmail SMTP)
    - API Docs: Swagger/OpenAPI
    - Build: Maven`

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
