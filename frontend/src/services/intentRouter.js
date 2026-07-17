/**
 * intentRouter — Natural Language Intent Classifier
 *
 * Classifies a user message into one of the known intents using
 * keyword scoring. No external NLP library needed.
 *
 * The router decides:
 *   - DB intents  → handled by inventoryAPI.js (fast, live data)
 *   - AI intents  → handled by geminiService.js (with or without DB context)
 */

// ── Intent constants ─────────────────────────────────────────────────────────
export const INTENTS = {
  INVENTORY_SUMMARY:    'INVENTORY_SUMMARY',
  LOW_STOCK:            'LOW_STOCK',
  OUT_OF_STOCK:         'OUT_OF_STOCK',
  PRODUCT_SEARCH:       'PRODUCT_SEARCH',
  SALES_TODAY:          'SALES_TODAY',
  SALES_WEEKLY:         'SALES_WEEKLY',
  SALES_MONTHLY:        'SALES_MONTHLY',
  TOP_PRODUCTS:         'TOP_PRODUCTS',
  LEAST_PRODUCTS:       'LEAST_PRODUCTS',
  EXPIRING_PRODUCTS:    'EXPIRING_PRODUCTS',
  THEFT_ALERTS:         'THEFT_ALERTS',
  DAMAGE_RECORDS:       'DAMAGE_RECORDS',
  DEMAND_FORECAST:      'DEMAND_FORECAST',
  PENDING_REQUESTS:     'PENDING_REQUESTS',
  NOTIFICATIONS:        'NOTIFICATIONS',
  PRODUCT_DESCRIPTION:  'PRODUCT_DESCRIPTION',
  CUSTOMERS_SUMMARY:    'CUSTOMERS_SUMMARY',
  PROFIT_ANALYSIS:      'PROFIT_ANALYSIS',
  HELP:                 'HELP',
  AI_GENERAL:           'AI_GENERAL',   // fallback → pure Gemini
}

// ── Keyword maps (keyword → score) ───────────────────────────────────────────
const RULES = [
  {
    intent: INTENTS.LOW_STOCK,
    keywords: [
      'low stock', 'low stock products', 'running out', 'running low',
      'almost out', 'need restock', 'restock', 'below minimum', 'stock alert',
      'which products need', 'what products need', 'stock warning'
    ],
    score: 10,
  },
  {
    intent: INTENTS.OUT_OF_STOCK,
    keywords: [
      'out of stock', 'no stock', 'zero stock', 'empty stock',
      'not available', 'unavailable', 'finished', 'sold out'
    ],
    score: 10,
  },
  {
    intent: INTENTS.INVENTORY_SUMMARY,
    keywords: [
      'inventory summary', 'inventory status', 'show inventory', 'stock summary',
      'total inventory', 'all products', 'today\'s summary', 'overall stock',
      'inventory overview', 'dashboard', 'summary'
    ],
    score: 8,
  },
  {
    intent: INTENTS.SALES_TODAY,
    keywords: [
      'today\'s sales', 'today sales', 'sales today', 'revenue today',
      'today revenue', 'today\'s revenue', 'sold today', 'today\'s billing',
      'today billing', 'how much today', 'daily sales'
    ],
    score: 10,
  },
  {
    intent: INTENTS.SALES_WEEKLY,
    keywords: [
      'weekly sales', 'this week sales', 'week sales', 'last 7 days',
      'past week', 'this week revenue', 'week revenue', '7 days'
    ],
    score: 10,
  },
  {
    intent: INTENTS.SALES_MONTHLY,
    keywords: [
      'monthly sales', 'this month sales', 'month sales', 'last 30 days',
      'past month', 'this month revenue', 'month revenue', '30 days',
      'last month'
    ],
    score: 10,
  },
  {
    intent: INTENTS.TOP_PRODUCTS,
    keywords: [
      'top selling', 'best selling', 'best sellers', 'most sold',
      'top products', 'popular products', 'highest selling', 'most popular'
    ],
    score: 10,
  },
  {
    intent: INTENTS.LEAST_PRODUCTS,
    keywords: [
      'least selling', 'slow moving', 'slow-moving', 'lowest selling',
      'least sold', 'worst selling', 'not selling', 'no demand'
    ],
    score: 10,
  },
  {
    intent: INTENTS.EXPIRING_PRODUCTS,
    keywords: [
      'expiring', 'expire', 'near expiry', 'expiry date', 'expiration',
      'about to expire', 'expires soon', 'expiring products', 'expiring this month'
    ],
    score: 10,
  },
  {
    intent: INTENTS.THEFT_ALERTS,
    keywords: [
      'theft', 'theft alert', 'stock loss', 'missing stock', 'stolen',
      'inventory loss', 'unexplained loss', 'stock mismatch', 'fraud',
      'missing inventory', 'loss detection', 'theft detection', 'theft records'
    ],
    score: 10,
  },
  {
    intent: INTENTS.DAMAGE_RECORDS,
    keywords: [
      'damage', 'damaged', 'damaged products', 'broken', 'defective',
      'expired products', 'damage records', 'wastage', 'damage today'
    ],
    score: 10,
  },
  {
    intent: INTENTS.DEMAND_FORECAST,
    keywords: [
      'forecast', 'predict', 'prediction', 'demand', 'demand forecast',
      'reorder', 'when will', 'run out', 'how long', 'days left',
      'stock days', 'recommend reorder', 'reorder quantity', 'will finish',
      'future stock', 'when to order'
    ],
    score: 10,
  },
  {
    intent: INTENTS.PENDING_REQUESTS,
    keywords: [
      'supply request', 'supply requests', 'pending request', 'pending orders',
      'pending supply', 'order status', 'supplier request', 'reorder request'
    ],
    score: 10,
  },
  {
    intent: INTENTS.NOTIFICATIONS,
    keywords: [
      'notification', 'notifications', 'latest alert', 'alerts', 'unread',
      'recent notification', 'show notifications', 'latest notifications'
    ],
    score: 10,
  },
  {
    intent: INTENTS.PRODUCT_DESCRIPTION,
    keywords: [
      'generate description', 'product description', 'describe product',
      'write description', 'description for', 'ai description', 'generate info',
      'product info', 'product details', 'generate features', 'product features'
    ],
    score: 10,
  },
  {
    intent: INTENTS.CUSTOMERS_SUMMARY,
    keywords: [
      'customers', 'total customers', 'customer count', 'how many customers',
      'customer list', 'customer summary'
    ],
    score: 8,
  },
  {
    intent: INTENTS.PROFIT_ANALYSIS,
    keywords: [
      'profit', 'margin', 'profitable', 'most profitable', 'gross profit',
      'profit analysis', 'profitability', 'earnings'
    ],
    score: 10,
  },
  {
    intent: INTENTS.PRODUCT_SEARCH,
    keywords: [
      'how much', 'how many', 'quantity of', 'stock of', 'available',
      'availability', 'show me', 'find product', 'search product',
      'product price', 'price of', 'selling price'
    ],
    score: 6,   // lower base — often generic
  },
  {
    intent: INTENTS.HELP,
    keywords: [
      'help', 'what can you do', 'what do you know', 'capabilities',
      'commands', 'options', 'features', 'what can i ask'
    ],
    score: 10,
  },
]

/**
 * Classify a user message into an intent.
 *
 * @param {string} message - raw user input
 * @param {boolean} isAuthenticated - whether user is logged in
 * @returns {{ intent: string, productQuery: string|null }}
 */
export function classifyIntent(message, isAuthenticated = true) {
  // Unauthenticated users get Gemini-only
  if (!isAuthenticated) {
    return { intent: INTENTS.AI_GENERAL, productQuery: null }
  }

  const lower = message.toLowerCase().trim()

  // Score each intent
  const scores = {}
  for (const rule of RULES) {
    let ruleScore = 0
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        ruleScore += rule.score
      }
    }
    if (ruleScore > 0) {
      scores[rule.intent] = (scores[rule.intent] || 0) + ruleScore
    }
  }

  // Pick highest scoring intent
  let bestIntent = INTENTS.AI_GENERAL
  let bestScore  = 0
  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore  = score
      bestIntent = intent
    }
  }

  // For product search: try to extract product name
  let productQuery = null
  if (bestIntent === INTENTS.PRODUCT_SEARCH) {
    const patterns = [
      /(?:how much|how many|stock of|quantity of|available|price of|show me?|find|search)\s+(.+?)(?:\s+(?:available|in stock|left|remaining))?$/i,
    ]
    for (const p of patterns) {
      const m = message.match(p)
      if (m && m[1]?.trim().length > 1) {
        productQuery = m[1].trim()
        break
      }
    }
    // If no extraction, fall back to AI
    if (!productQuery) {
      const words = message.split(' ').filter(w => w.length > 3)
      productQuery = words.slice(-3).join(' ') || null
    }
  }

  return { intent: bestIntent, productQuery }
}

/**
 * Returns a human-readable label for an intent (for UI badges)
 */
export function intentLabel(intent) {
  const labels = {
    [INTENTS.INVENTORY_SUMMARY]:  '📦 Inventory',
    [INTENTS.LOW_STOCK]:          '⚠️ Low Stock',
    [INTENTS.OUT_OF_STOCK]:       '❌ Out of Stock',
    [INTENTS.PRODUCT_SEARCH]:     '🔍 Product',
    [INTENTS.SALES_TODAY]:        '📊 Sales Today',
    [INTENTS.SALES_WEEKLY]:       '📊 Weekly Sales',
    [INTENTS.SALES_MONTHLY]:      '📊 Monthly Sales',
    [INTENTS.TOP_PRODUCTS]:       '🏆 Top Products',
    [INTENTS.LEAST_PRODUCTS]:     '📉 Slow Movers',
    [INTENTS.EXPIRING_PRODUCTS]:  '⏰ Expiring',
    [INTENTS.THEFT_ALERTS]:       '🔴 Theft Alerts',
    [INTENTS.DAMAGE_RECORDS]:     '🛠️ Damage',
    [INTENTS.DEMAND_FORECAST]:    '🔮 Forecast',
    [INTENTS.PENDING_REQUESTS]:   '📋 Requests',
    [INTENTS.NOTIFICATIONS]:      '🔔 Notifications',
    [INTENTS.PRODUCT_DESCRIPTION]:'✍️ Description',
    [INTENTS.CUSTOMERS_SUMMARY]:  '👥 Customers',
    [INTENTS.PROFIT_ANALYSIS]:    '💰 Profit',
    [INTENTS.HELP]:               '❓ Help',
    [INTENTS.AI_GENERAL]:         '🤖 AI',
  }
  return labels[intent] || '🤖 AI'
}
