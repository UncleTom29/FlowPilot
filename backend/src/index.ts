import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { parseRule, describeRule } from './nlCompiler';
import { buildTransactionsFromRule } from './flowActionsBuilder';
import { registerScheduler } from './schedulerRegistrar';

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3001;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.VITE_BACKEND_URL ? '*' : 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: Date.now() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rule parsing — real-time preview as user types
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/parse-rule', (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'text field required', rawText: text ?? '' },
    });
  }

  const result = parseRule(text);

  if (result.success) {
    return res.json({
      success: true,
      rule: result.rule,
      description: describeRule(result.rule),
      transactions: buildTransactionsFromRule('preview', result.rule).map(t => ({
        description: t.description,
        args: t.args,
      })),
    });
  } else {
    return res.json({
      success: false,
      error: result.error,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Rule creation — compiles, builds transactions, registers scheduler
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/create-rule', async (req: Request, res: Response) => {
  const { text, streamId, userAddress } = req.body;

  if (!text || !streamId) {
    return res.status(400).json({
      success: false,
      error: 'text and streamId are required',
    });
  }

  const parseResult = parseRule(text);

  if (!parseResult.success) {
    return res.status(422).json({
      success: false,
      error: parseResult.error,
    });
  }

  const rule = parseResult.rule;

  try {
    // Build Cadence transactions for this rule
    const transactions = buildTransactionsFromRule(streamId, rule);

    // Register scheduler if needed
    let schedulerId: string | undefined;
    if (rule.schedulerConfig) {
      const regResult = await registerScheduler({
        streamId,
        handlerType: rule.schedulerConfig.handlerType,
        intervalSeconds: rule.schedulerConfig.intervalSeconds,
        firstFireDelay: rule.schedulerConfig.firstFireDelay,
        ruleId: rule.id,
      });
      schedulerId = regResult.schedulerId;
    }

    return res.json({
      success: true,
      rule,
      description: describeRule(rule),
      transactions: transactions.map(t => ({
        code: t.code,
        args: t.args,
        description: t.description,
      })),
      schedulerId,
    });
  } catch (err) {
    console.error('[CreateRule] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create rule',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stream creation
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/create-stream', async (req: Request, res: Response) => {
  const {
    streamId,
    employerAddress,
    workerAddress,
    ratePerSecond,
    yieldSplitRatio = 0.8,
    milestoneIntervalDays = 30,
    initialFunding,
    workerRole = 'Employee',
  } = req.body;

  if (!streamId || !employerAddress || !workerAddress || !ratePerSecond || !initialFunding) {
    return res.status(400).json({
      success: false,
      error: 'streamId, employerAddress, workerAddress, ratePerSecond, and initialFunding are required',
    });
  }

  // Build CreateStream.cdc transaction
  const transactionCode = `
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import WorkCredential from 0x0000000000000000
import RuleGraph from 0x0000000000000000

transaction(streamId: String, workerAddress: Address, ratePerSecond: UFix64, yieldSplitRatio: UFix64, milestoneIntervalDays: UFix64, initialFundingAmount: UFix64, workerRole: String) {
  prepare(employer: auth(Storage, Capabilities) &Account) {
    // Implementation in CreateStream.cdc
    log("Stream created: ".concat(streamId))
  }
}`;

  return res.json({
    success: true,
    transaction: {
      code: transactionCode,
      args: [
        { type: 'String', value: streamId },
        { type: 'Address', value: workerAddress },
        { type: 'UFix64', value: ratePerSecond.toFixed(8) },
        { type: 'UFix64', value: yieldSplitRatio.toFixed(8) },
        { type: 'UFix64', value: milestoneIntervalDays.toFixed(1) },
        { type: 'UFix64', value: initialFunding.toFixed(8) },
        { type: 'String', value: workerRole },
      ],
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  console.error('[FlowPilot Backend] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`FlowPilot Backend running on http://localhost:${PORT}`);
  console.log(`Network: ${process.env.VITE_FLOW_NETWORK ?? 'testnet'}`);
});

export default app;
