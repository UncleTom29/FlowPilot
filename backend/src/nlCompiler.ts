import { v4 as uuidv4 } from 'uuid';
import {
  RuleType,
  RuleDefinition,
  FlowActionNode,
  ParseResult,
  ParseError,
  INTERVALS,
  DAY_NAMES,
} from './ruleTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Pattern matchers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "save X% of every paycheck" → savings_split
 * "put X% of my salary into savings"
 */
function matchSavingsSplit(text: string): RuleDefinition | null {
  const pattern = /save\s+(\d+(?:\.\d+)?)\s*%\s+(?:of\s+every\s+paycheck|of\s+(?:my\s+)?(?:salary|income|paycheck))/i;
  const match = text.match(pattern);
  if (!match) return null;

  const ratio = parseFloat(match[1]) / 100;
  const actions: FlowActionNode[] = [
    {
      type: 'split',
      params: { ratio, destination: 'savings_vault' },
    },
    {
      type: 'deposit',
      params: { targetProtocol: 'FlowYield', amount: 0, useRatio: true },
    },
  ];

  return {
    id: uuidv4(),
    type: 'savings_split',
    rawText: text,
    params: { ratio, percentage: parseFloat(match[1]) },
    flowActions: actions,
  };
}

/**
 * "buy $X of ASSET every DAY/WEEK/MONTH"
 * "buy $X ASSET every FRIDAY"
 * "invest $X in ASSET weekly"
 */
function matchDCA(text: string): RuleDefinition | null {
  const pattern =
    /(?:buy|invest|purchase)\s+\$?(\d+(?:\.\d+)?)\s+(?:of\s+)?(\w+)\s+every\s+(\w+(?:\s+\w+)?)/i;
  const match = text.match(pattern);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  const asset = match[2].toUpperCase();
  const intervalText = match[3].toLowerCase().trim();

  let intervalSeconds: number;
  let handlerInterval = intervalText;

  if (DAY_NAMES[intervalText] !== undefined) {
    // Specific day of week → weekly interval
    intervalSeconds = INTERVALS.weekly;
    handlerInterval = 'weekly';
  } else if (intervalText === 'day' || intervalText === 'daily') {
    intervalSeconds = INTERVALS.daily;
  } else if (intervalText === 'week' || intervalText === 'weekly') {
    intervalSeconds = INTERVALS.weekly;
  } else if (intervalText === 'month' || intervalText === 'monthly') {
    intervalSeconds = INTERVALS.monthly;
  } else if (intervalText === 'hour' || intervalText === 'hourly') {
    intervalSeconds = INTERVALS.hourly;
  } else {
    intervalSeconds = INTERVALS.weekly; // default
  }

  const actions: FlowActionNode[] = [
    {
      type: 'swap',
      params: {
        fromAsset: 'USDC',
        toAsset: asset,
        amount,
        slippageTolerance: 0.005,
      },
    },
  ];

  return {
    id: uuidv4(),
    type: 'dca',
    rawText: text,
    params: { amount, asset, intervalSeconds, intervalText: handlerInterval },
    flowActions: actions,
    schedulerConfig: {
      intervalSeconds,
      firstFireDelay: intervalSeconds,
      handlerType: 'DCAHandler',
    },
  };
}

/**
 * "pay $X to ADDRESS.flow on the Nth of each month"
 * "send $X to ADDRESS every month"
 * "pay rent $X to ADDRESS on the 1st"
 */
function matchSubscription(text: string): RuleDefinition | null {
  const pattern =
    /(?:pay|send)\s+(?:rent\s+)?\$?(\d+(?:\.\d+)?)\s+to\s+([\w.]+(?:\.flow)?)\s+(?:on\s+the\s+(\d+)(?:st|nd|rd|th)?\s+(?:of\s+each\s+month)?|every\s+(\w+))/i;
  const match = text.match(pattern);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  const payee = match[2];
  const dayOfMonth = match[3] ? parseInt(match[3]) : 1;
  const intervalText = match[4]?.toLowerCase();

  let intervalSeconds: number;
  if (intervalText) {
    intervalSeconds = (INTERVALS as any)[intervalText] ?? INTERVALS.monthly;
  } else {
    intervalSeconds = INTERVALS.monthly;
  }

  const actions: FlowActionNode[] = [
    {
      type: 'transfer',
      params: { recipient: payee, amount },
    },
  ];

  return {
    id: uuidv4(),
    type: 'subscription',
    rawText: text,
    params: { amount, payee, dayOfMonth, intervalSeconds },
    flowActions: actions,
    schedulerConfig: {
      intervalSeconds,
      firstFireDelay: intervalSeconds,
      handlerType: 'SubscriptionHandler',
    },
  };
}

/**
 * "round up every withdrawal to nearest $X"
 * "round up purchases to the nearest $1 and save"
 */
function matchRoundUp(text: string): RuleDefinition | null {
  const pattern = /round\s+up\s+(?:every\s+)?(?:withdrawal|purchase|transaction)s?\s+to\s+(?:the\s+)?nearest\s+\$?(\d+(?:\.\d+)?)/i;
  const match = text.match(pattern);
  if (!match) return null;

  const bucketSize = parseFloat(match[1]);

  const actions: FlowActionNode[] = [
    {
      type: 'roundup',
      params: { bucketSize, destination: 'savings_vault' },
    },
  ];

  return {
    id: uuidv4(),
    type: 'roundup',
    rawText: text,
    params: { bucketSize },
    flowActions: actions,
  };
}

/**
 * "keep portfolio X% ASSET1, Y% ASSET2, rebalance FREQUENCY"
 * "allocate X% FLOW, Y% USDC and rebalance daily"
 */
function matchPortfolio(text: string): RuleDefinition | null {
  const allocationPattern = /(\d+(?:\.\d+)?)\s*%\s+(\w+)/g;
  const rebalancePattern = /rebalance\s+(\w+ly|daily|weekly|monthly)/i;

  const allocations: Record<string, number> = {};
  let match;
  while ((match = allocationPattern.exec(text)) !== null) {
    allocations[match[2].toUpperCase()] = parseFloat(match[1]);
  }

  if (Object.keys(allocations).length === 0) return null;
  if (!text.match(/portfolio|allocat|rebalance/i)) return null;

  const rebalanceMatch = text.match(rebalancePattern);
  const rebalanceFreq = rebalanceMatch ? rebalanceMatch[1].toLowerCase() : 'daily';
  const intervalSeconds = (INTERVALS as any)[rebalanceFreq] ?? INTERVALS.daily;

  // Determine risk profile from frequency
  let riskProfile = 'moderate';
  if (intervalSeconds >= INTERVALS.weekly) {
    riskProfile = 'conservative';
  } else if (intervalSeconds <= 21600) {
    riskProfile = 'aggressive';
  }

  const actions: FlowActionNode[] = [
    {
      type: 'portfolio_rebalance',
      params: { allocations: JSON.stringify(allocations), riskProfile },
    },
  ];

  return {
    id: uuidv4(),
    type: 'portfolio',
    rawText: text,
    params: { allocations, riskProfile, intervalSeconds },
    flowActions: actions,
    schedulerConfig: {
      intervalSeconds,
      firstFireDelay: intervalSeconds,
      handlerType: 'AIRebalanceHandler',
    },
  };
}

/**
 * "send $X gift card to ADDRESS on DATE"
 * "give ADDRESS a $X gift card for OCCASION"
 */
function matchGiftCard(text: string): RuleDefinition | null {
  const pattern =
    /(?:send|give)\s+(?:([\w.]+(?:\.flow)?)\s+)?(?:a\s+)?\$?(\d+(?:\.\d+)?)\s+gift\s+card\s+(?:to\s+([\w.]+(?:\.flow)?))?/i;
  const match = text.match(pattern);
  if (!match) return null;

  const amount = parseFloat(match[2]);
  const recipient = match[1] || match[3] || '';

  // Parse optional date
  const datePattern = /on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;
  const dateMatch = text.match(datePattern);
  const targetDate = dateMatch ? new Date(dateMatch[1]).getTime() / 1000 : null;

  const actions: FlowActionNode[] = [
    {
      type: 'mint_giftcard',
      params: { amount, recipient, targetDate: targetDate ?? 0 },
    },
  ];

  return {
    id: uuidv4(),
    type: 'giftcard',
    rawText: text,
    params: { amount, recipient, targetDate },
    flowActions: actions,
  };
}

/**
 * "enter $X into the daily lottery"
 * "put $X in the lottery"
 */
function matchLotteryEntry(text: string): RuleDefinition | null {
  const pattern = /(?:enter|put|deposit)\s+\$?(\d+(?:\.\d+)?)\s+(?:into\s+)?(?:the\s+)?(?:daily\s+)?lottery/i;
  const match = text.match(pattern);
  if (!match) return null;

  const amount = parseFloat(match[1]);

  const actions: FlowActionNode[] = [
    {
      type: 'lottery_deposit',
      params: { amount },
    },
  ];

  return {
    id: uuidv4(),
    type: 'lottery_entry',
    rawText: text,
    params: { amount },
    flowActions: actions,
    schedulerConfig: {
      intervalSeconds: INTERVALS.daily,
      firstFireDelay: INTERVALS.daily,
      handlerType: 'LotteryDrawHandler',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main compiler
// ─────────────────────────────────────────────────────────────────────────────

const MATCHERS: Array<(text: string) => RuleDefinition | null> = [
  matchSavingsSplit,
  matchDCA,
  matchSubscription,
  matchRoundUp,
  matchPortfolio,
  matchGiftCard,
  matchLotteryEntry,
];

const SUGGESTIONS: Record<RuleType, string> = {
  savings_split: 'save 20% of every paycheck',
  dca: 'buy $50 FLOW every Friday',
  subscription: 'pay $1200 to landlord.flow on the 1st of each month',
  roundup: 'round up every withdrawal to nearest $1',
  portfolio: 'keep portfolio 60% FLOW, 40% USDC, rebalance weekly',
  giftcard: 'send $100 gift card to friend.flow on 2024-12-25',
  lottery_entry: 'enter $50 into the daily lottery',
};

/**
 * Parse a natural language rule into a structured RuleDefinition.
 * Returns structured error with suggestions on failure — never silently fails.
 */
export function parseRule(rawText: string): ParseResult {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: 'Rule text cannot be empty',
        rawText,
        suggestion: 'Try: "save 20% of every paycheck"',
      },
    };
  }

  // Try all matchers
  for (const matcher of MATCHERS) {
    const result = matcher(trimmed);
    if (result) {
      return { success: true, rule: result };
    }
  }

  // Find closest matching pattern via keyword scoring
  const closest = findClosestPattern(trimmed);

  return {
    success: false,
    error: {
      code: 'UNRECOGNIZED_PATTERN',
      message: `Could not parse rule: "${trimmed}"`,
      closestMatch: closest,
      suggestion: SUGGESTIONS[closest as RuleType] ?? 'save 20% of every paycheck',
      rawText,
    },
  };
}

function findClosestPattern(text: string): string {
  const keywords: Record<string, string[]> = {
    savings_split: ['save', 'saving', 'paycheck', 'salary', 'income'],
    dca: ['buy', 'invest', 'purchase', 'every', 'weekly', 'daily', 'friday'],
    subscription: ['pay', 'rent', 'subscription', '1st', 'monthly', 'send to'],
    roundup: ['round', 'nearest', 'withdrawal'],
    portfolio: ['portfolio', 'allocate', 'rebalance', '%'],
    giftcard: ['gift', 'card', 'give'],
    lottery_entry: ['lottery', 'lotto', 'lucky'],
  };

  let bestMatch = 'savings_split';
  let bestScore = 0;
  const lower = text.toLowerCase();

  for (const [pattern, words] of Object.entries(keywords)) {
    const score = words.filter((w) => lower.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  return bestMatch;
}

/**
 * Generate a human-readable interpretation of a parsed rule.
 */
export function describeRule(rule: RuleDefinition): string {
  switch (rule.type) {
    case 'savings_split': {
      const pct = ((rule.params.ratio as number) * 100).toFixed(0);
      return `Save ${pct}% of every paycheck into your yield vault`;
    }
    case 'dca': {
      const { amount, asset, intervalText } = rule.params;
      return `Buy $${amount} of ${asset} every ${intervalText}`;
    }
    case 'subscription': {
      const { amount, payee, dayOfMonth } = rule.params;
      return `Pay $${amount} to ${payee} on the ${dayOfMonth}${ordinal(dayOfMonth as number)} of each month`;
    }
    case 'roundup': {
      return `Round up every withdrawal to the nearest $${rule.params.bucketSize} and save the difference`;
    }
    case 'portfolio': {
      const allocStr = Object.entries(rule.params.allocations as Record<string, number>)
        .map(([asset, pct]) => `${pct}% ${asset}`)
        .join(', ');
      return `Keep portfolio: ${allocStr}. Rebalance ${rule.params.riskProfile}ly`;
    }
    case 'giftcard': {
      const { amount, recipient } = rule.params;
      return `Send a $${amount} yield-bearing gift card to ${recipient}`;
    }
    case 'lottery_entry': {
      return `Enter $${rule.params.amount} into the daily lossless lottery`;
    }
    default:
      return 'Unknown rule type';
  }
}

function ordinal(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n) : n;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
