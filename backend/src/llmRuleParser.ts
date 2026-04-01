import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  DAY_NAMES,
  INTERVALS,
  ParseResult,
  RuleDefinition,
  RuleType,
  SchedulerConfig,
} from './ruleTypes';

interface ProviderConfig {
  client: OpenAI;
  label: string;
  model: string;
}

const SYSTEM_PROMPT = `You convert one natural-language finance rule into structured JSON.

Supported rule types:
- savings_split
- dca
- subscription
- roundup
- portfolio
- giftcard
- lottery_entry

Return only valid JSON with this shape:
{
  "supported": true,
  "type": "one of the supported rule types",
  "params": {
    "...": "type-specific fields"
  }
}

Type-specific params:
- savings_split: { "percentage": number } or { "ratio": number }
- dca: { "amount": number, "asset": string, "intervalText": string }
- subscription: { "amount": number, "payee": string, "dayOfMonth": number, "intervalText": string }
- roundup: { "bucketSize": number }
- portfolio: { "allocations": { "FLOW": number, "USDC": number }, "riskProfile": "conservative|moderate|aggressive", "intervalText": string }
- giftcard: { "amount": number, "recipient": string, "targetDate": string or number or null }
- lottery_entry: { "amount": number }

If the input is ambiguous, unsupported, or unsafe to infer, return:
{
  "supported": false,
  "reason": "short explanation"
}`;

function numberFrom(value: unknown, field: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field: ${field}`);
  }

  return parsed;
}

function stringFrom(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid string field: ${field}`);
  }

  return value.trim();
}

function resolveInterval(intervalText: unknown, fallback: number) {
  const normalized =
    typeof intervalText === 'string' && intervalText.trim() !== ''
      ? intervalText.trim().toLowerCase()
      : '';

  if (DAY_NAMES[normalized] !== undefined) {
    return {
      intervalSeconds: INTERVALS.weekly,
      intervalText: 'weekly',
    };
  }

  switch (normalized) {
    case 'hour':
    case 'hourly':
      return { intervalSeconds: INTERVALS.hourly, intervalText: 'hourly' };
    case 'day':
    case 'daily':
      return { intervalSeconds: INTERVALS.daily, intervalText: 'daily' };
    case 'week':
    case 'weekly':
      return { intervalSeconds: INTERVALS.weekly, intervalText: 'weekly' };
    case 'month':
    case 'monthly':
      return { intervalSeconds: INTERVALS.monthly, intervalText: 'monthly' };
    case 'year':
    case 'yearly':
      return { intervalSeconds: INTERVALS.yearly, intervalText: 'yearly' };
    default:
      return {
        intervalSeconds: fallback,
        intervalText:
          fallback === INTERVALS.daily
            ? 'daily'
            : fallback === INTERVALS.monthly
            ? 'monthly'
            : 'weekly',
      };
  }
}

function parseTargetDate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string') {
    const asNumber = Number.parseFloat(value);
    if (Number.isFinite(asNumber)) {
      return asNumber > 10_000_000_000 ? Math.floor(asNumber / 1000) : Math.floor(asNumber);
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  throw new Error('Invalid targetDate');
}

function buildScheduler(intervalSeconds: number, handlerType: string): SchedulerConfig {
  return {
    intervalSeconds,
    firstFireDelay: intervalSeconds,
    handlerType,
  };
}

function buildRuleDefinition(type: RuleType, params: Record<string, unknown>, rawText: string): RuleDefinition {
  switch (type) {
    case 'savings_split': {
      const ratio =
        params.ratio !== undefined
          ? numberFrom(params.ratio, 'ratio')
          : numberFrom(params.percentage, 'percentage') / 100;

      return {
        id: uuidv4(),
        type,
        rawText,
        params: {
          ratio,
          percentage: ratio * 100,
        },
        flowActions: [
          {
            type: 'split',
            params: { ratio, destination: 'savings_vault' },
          },
          {
            type: 'deposit',
            params: { targetProtocol: 'FlowYield', amount: 0, useRatio: true },
          },
        ],
      };
    }

    case 'dca': {
      const amount = numberFrom(params.amount, 'amount');
      const asset = stringFrom(params.asset, 'asset').toUpperCase();
      const interval = resolveInterval(params.intervalText, INTERVALS.weekly);

      return {
        id: uuidv4(),
        type,
        rawText,
        params: {
          amount,
          asset,
          intervalSeconds: interval.intervalSeconds,
          intervalText: interval.intervalText,
        },
        flowActions: [
          {
            type: 'swap',
            params: {
              fromAsset: 'USDC',
              toAsset: asset,
              amount,
              slippageTolerance: 0.005,
            },
          },
        ],
        schedulerConfig: buildScheduler(interval.intervalSeconds, 'DCAHandler'),
      };
    }

    case 'subscription': {
      const amount = numberFrom(params.amount, 'amount');
      const payee = stringFrom(params.payee, 'payee');
      const dayOfMonth =
        params.dayOfMonth !== undefined ? Math.max(1, Math.floor(numberFrom(params.dayOfMonth, 'dayOfMonth'))) : 1;
      const interval = resolveInterval(params.intervalText, INTERVALS.monthly);

      return {
        id: uuidv4(),
        type,
        rawText,
        params: {
          amount,
          payee,
          dayOfMonth,
          intervalSeconds: interval.intervalSeconds,
        },
        flowActions: [
          {
            type: 'transfer',
            params: { recipient: payee, amount },
          },
        ],
        schedulerConfig: buildScheduler(interval.intervalSeconds, 'SubscriptionHandler'),
      };
    }

    case 'roundup': {
      const bucketSize = numberFrom(params.bucketSize, 'bucketSize');

      return {
        id: uuidv4(),
        type,
        rawText,
        params: { bucketSize },
        flowActions: [
          {
            type: 'roundup',
            params: { bucketSize, destination: 'savings_vault' },
          },
        ],
      };
    }

    case 'portfolio': {
      const allocationsInput = params.allocations;
      if (
        !allocationsInput ||
        typeof allocationsInput !== 'object' ||
        Array.isArray(allocationsInput)
      ) {
        throw new Error('Invalid portfolio allocations');
      }

      const allocations = Object.fromEntries(
        Object.entries(allocationsInput).map(([asset, percentage]) => [
          asset.toUpperCase(),
          numberFrom(percentage, `allocations.${asset}`),
        ])
      );

      const interval = resolveInterval(params.intervalText, INTERVALS.daily);
      let riskProfile =
        typeof params.riskProfile === 'string' ? params.riskProfile.trim().toLowerCase() : '';

      if (!['conservative', 'moderate', 'aggressive'].includes(riskProfile)) {
        if (interval.intervalSeconds >= INTERVALS.weekly) {
          riskProfile = 'conservative';
        } else if (interval.intervalSeconds <= 21600) {
          riskProfile = 'aggressive';
        } else {
          riskProfile = 'moderate';
        }
      }

      return {
        id: uuidv4(),
        type,
        rawText,
        params: {
          allocations,
          riskProfile,
          intervalSeconds: interval.intervalSeconds,
        },
        flowActions: [
          {
            type: 'portfolio_rebalance',
            params: {
              allocations: JSON.stringify(allocations),
              riskProfile,
            },
          },
        ],
        schedulerConfig: buildScheduler(interval.intervalSeconds, 'AIRebalanceHandler'),
      };
    }

    case 'giftcard': {
      const amount = numberFrom(params.amount, 'amount');
      const recipient = stringFrom(params.recipient, 'recipient');
      const targetDate = parseTargetDate(params.targetDate);

      return {
        id: uuidv4(),
        type,
        rawText,
        params: {
          amount,
          recipient,
          targetDate,
        },
        flowActions: [
          {
            type: 'mint_giftcard',
            params: { amount, recipient, targetDate: targetDate ?? 0 },
          },
        ],
      };
    }

    case 'lottery_entry': {
      const amount = numberFrom(params.amount, 'amount');

      return {
        id: uuidv4(),
        type,
        rawText,
        params: { amount },
        flowActions: [
          {
            type: 'lottery_deposit',
            params: { amount },
          },
        ],
        schedulerConfig: buildScheduler(INTERVALS.daily, 'LotteryDrawHandler'),
      };
    }

    default:
      throw new Error(`Unsupported rule type: ${type}`);
  }
}

function buildProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      label: 'OpenAI',
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      client: new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_APP_NAME ?? 'FlowPilot',
        },
      }),
      label: 'OpenRouter',
      model:
        process.env.OPENROUTER_FALLBACK_MODEL ?? 'google/gemini-2.5-flash-lite',
    });
  }

  return providers;
}

function isRuleType(value: unknown): value is RuleType {
  return (
    value === 'savings_split' ||
    value === 'dca' ||
    value === 'subscription' ||
    value === 'roundup' ||
    value === 'portfolio' ||
    value === 'giftcard' ||
    value === 'lottery_entry'
  );
}

async function requestStructuredRule(provider: ProviderConfig, rawText: string): Promise<RuleDefinition | null> {
  const completion = await provider.client.chat.completions.create({
    model: provider.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: rawText,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as {
    supported?: boolean;
    type?: unknown;
    params?: Record<string, unknown>;
  };

  if (!parsed.supported || !isRuleType(parsed.type) || !parsed.params) {
    return null;
  }

  return buildRuleDefinition(parsed.type, parsed.params, rawText);
}

export async function parseRuleWithLLM(rawText: string): Promise<ParseResult | null> {
  const providers = buildProviders();

  for (const provider of providers) {
    try {
      const rule = await requestStructuredRule(provider, rawText);
      if (rule) {
        return { success: true, rule };
      }
    } catch (error) {
      console.warn(`[RuleParser] ${provider.label} provider failed:`, error);
    }
  }

  return null;
}
