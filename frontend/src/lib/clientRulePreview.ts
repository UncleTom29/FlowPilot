import { DEPLOYMENT_SNAPSHOT_STATE } from './deploymentState';

type PreviewRule = {
  type: string;
  rawText: string;
  params: Record<string, unknown>;
  flowActions: Array<{ type: string; params: Record<string, unknown> }>;
  schedulerConfig?: { intervalSeconds: number; firstFireDelay: number; handlerType?: string };
};

type PreviewResponse = {
  success: boolean;
  rule?: PreviewRule;
  description?: string;
  transactions?: Array<{ description: string; args: Record<string, unknown> }>;
  error?: { code: string; message: string };
  source?: 'local-parser';
};

const INTERVALS = {
  hourly: 3_600,
  daily: 86_400,
  weekly: 604_800,
  monthly: 2_592_000,
} as const;

const SNAPSHOT_POOL_ID = DEPLOYMENT_SNAPSHOT_STATE.cadence?.poolId ?? '';

function buildRule(
  type: string,
  rawText: string,
  params: Record<string, unknown>,
  description: string,
  flowActions: Array<{ type: string; params: Record<string, unknown> }>,
  schedulerConfig?: PreviewRule['schedulerConfig']
): PreviewResponse {
  return {
    success: true,
    source: 'local-parser',
    rule: {
      type,
      rawText,
      params,
      flowActions,
      schedulerConfig,
    },
    description,
    transactions: flowActions.map((action, index) => ({
      description: `${index + 1}. ${action.type}`,
      args: action.params,
    })),
  };
}

function normalizeInterval(raw: string | undefined) {
  const interval = raw?.toLowerCase().trim() ?? 'weekly';

  if (interval === 'day' || interval === 'daily') {
    return { label: 'daily', seconds: INTERVALS.daily };
  }

  if (interval === 'week' || interval === 'weekly') {
    return { label: 'weekly', seconds: INTERVALS.weekly };
  }

  if (interval === 'month' || interval === 'monthly') {
    return { label: 'monthly', seconds: INTERVALS.monthly };
  }

  if (interval === 'hour' || interval === 'hourly') {
    return { label: 'hourly', seconds: INTERVALS.hourly };
  }

  return { label: interval || 'weekly', seconds: INTERVALS.weekly };
}

export function parseRuleClientSide(text: string): PreviewResponse {
  const normalized = text.trim();
  if (!normalized) {
    return {
      success: false,
      error: { code: 'EMPTY_RULE', message: 'Enter a rule to preview the automation.' },
      source: 'local-parser',
    };
  }

  const savingsSplit = normalized.match(
    /(?:save|route)\s+(\d+(?:\.\d+)?)\s*%\s+(?:of\s+every\s+paycheck|of\s+(?:my\s+)?(?:salary|income|claim|paycheck))/i
  );
  if (savingsSplit) {
    const percentage = Number(savingsSplit[1]);
    const ratio = percentage / 100;
    return buildRule(
      'savings_split',
      normalized,
      { ratio, percentage },
      `Save ${percentage}% of every paycheck into the FlowPilot reserve vault.`,
      [
        { type: 'split', params: { ratio, destination: 'savings_vault' } },
        { type: 'deposit', params: { targetProtocol: 'FlowYield', useRatio: true } },
      ]
    );
  }

  const dca = normalized.match(
    /(?:buy|invest|purchase)\s+\$?(\d+(?:\.\d+)?)\s+(?:of\s+)?([a-z0-9]+)\s+every\s+([a-z]+(?:\s+[a-z]+)?)/i
  );
  if (dca) {
    const amount = Number(dca[1]);
    const asset = dca[2].toUpperCase();
    const interval = normalizeInterval(dca[3]);
    return buildRule(
      'dca',
      normalized,
      { amount, asset, intervalText: interval.label, intervalSeconds: interval.seconds },
      `Buy ${amount} FLOW-equivalent of ${asset} on a ${interval.label} cadence from treasury reserves.`,
      [
        {
          type: 'swap',
          params: { fromAsset: 'USDC', toAsset: asset, amount, slippageTolerance: 0.005 },
        },
      ],
      {
        intervalSeconds: interval.seconds,
        firstFireDelay: interval.seconds,
        handlerType: 'DCAHandler',
      }
    );
  }

  const subscription = normalized.match(
    /(?:pay|send)\s+\$?(\d+(?:\.\d+)?)\s+(?:flow\s+)?(?:every\s+([a-z]+)|to\s+([\w.-]+)(?:\s+every\s+([a-z]+))?)/i
  );
  if (subscription) {
    const amount = Number(subscription[1]);
    const payee = subscription[3] ?? '';
    const interval = normalizeInterval(subscription[2] ?? subscription[4] ?? 'monthly');

    if (!payee) {
      return {
        success: false,
        source: 'local-parser',
        error: {
          code: 'PAYEE_REQUIRED',
          message: 'Specify a payee address or .flow name to preview a subscription rule.',
        },
      };
    }

    return buildRule(
      'subscription',
      normalized,
      { amount, payee, intervalSeconds: interval.seconds },
      `Pay ${amount} FLOW to ${payee} every ${interval.label} from the managed treasury.`,
      [{ type: 'transfer', params: { recipient: payee, amount } }],
      {
        intervalSeconds: interval.seconds,
        firstFireDelay: interval.seconds,
        handlerType: 'SubscriptionHandler',
      }
    );
  }

  const roundup = normalized.match(
    /round\s+up\s+(?:every\s+)?(?:purchase|withdrawal|transaction)s?\s+to\s+(?:the\s+)?nearest\s+\$?(\d+(?:\.\d+)?)/i
  );
  if (roundup) {
    const bucketSize = Number(roundup[1]);
    return buildRule(
      'roundup',
      normalized,
      { bucketSize },
      `Round each treasury spend up to the nearest ${bucketSize} FLOW unit and save the delta.`,
      [{ type: 'roundup', params: { bucketSize, destination: 'savings_vault' } }]
    );
  }

  const lottery = normalized.match(/(?:enter|deposit|put)\s+\$?(\d+(?:\.\d+)?)\s+(?:into\s+)?(?:the\s+)?lottery/i);
  if (lottery) {
    const amount = Number(lottery[1]);
    if (!SNAPSHOT_POOL_ID) {
      return {
        success: false,
        source: 'local-parser',
        error: {
          code: 'POOL_REQUIRED',
          message: 'No live lottery pool is configured for this environment yet.',
        },
      };
    }
    return buildRule(
      'lottery_entry',
      normalized,
      { amount },
      `Route ${amount} FLOW into the lossless lottery pool on schedule.`,
      [{ type: 'lottery_deposit', params: { amount, poolId: SNAPSHOT_POOL_ID } }],
      {
        intervalSeconds: INTERVALS.daily,
        firstFireDelay: INTERVALS.daily,
        handlerType: 'LotteryDrawHandler',
      }
    );
  }

  const portfolioAllocations = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*%\s+([a-z0-9]+)/gi)];
  if (portfolioAllocations.length > 0 && /portfolio|allocate|rebalance/i.test(normalized)) {
    const allocations = Object.fromEntries(
      portfolioAllocations.map((match) => [match[2].toUpperCase(), Number(match[1])])
    );
    const riskProfileMatch = normalized.match(/(conservative|moderate|aggressive)/i);
    const intervalMatch = normalized.match(/rebalance\s+([a-z]+)/i);
    const interval = normalizeInterval(intervalMatch?.[1] ?? 'daily');
    const riskProfile = riskProfileMatch?.[1]?.toLowerCase() ?? 'moderate';

    return buildRule(
      'portfolio',
      normalized,
      { allocations, riskProfile, intervalSeconds: interval.seconds },
      `Maintain an ${riskProfile} treasury portfolio and rebalance ${interval.label}.`,
      [{ type: 'portfolio_rebalance', params: { allocations, riskProfile } }],
      {
        intervalSeconds: interval.seconds,
        firstFireDelay: interval.seconds,
        handlerType: 'AIRebalanceHandler',
      }
    );
  }

  return {
    success: false,
    source: 'local-parser',
    error: {
      code: 'NO_MATCH',
      message:
        'The managed compiler is temporarily unavailable and the local parser could not confidently classify this rule. Try a DCA, savings split, subscription, portfolio, or lottery instruction.',
    },
  };
}
