import './env';
import path from 'node:path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { describeRule } from './nlCompiler';
import { buildTransactionsFromRule } from './flowActionsBuilder';
import { parseRuleWithFallback } from './ruleParser';
import { withCadenceImports } from './cadenceImports';
import {
  extractTransactionId,
  getDeploymentState,
  sendInlineTransaction,
  sendTransactionFile,
} from './flowCli';

const app = express();
const PORT = parseInt(process.env.PORT ?? process.env.BACKEND_PORT ?? '3001', 10);
const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredOrigins,
]);
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
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

app.get('/api/deployment-state', async (_req: Request, res: Response) => {
  try {
    const state = await getDeploymentState();
    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Rule parsing — real-time preview as user types
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/parse-rule', async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: 'text field required', rawText: text ?? '' },
    });
  }

  const result = await parseRuleWithFallback(text);

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
  const { text, streamId, relay = false } = req.body;

  if (!text || !streamId) {
    return res.status(400).json({
      success: false,
      error: 'text and streamId are required',
    });
  }

  const parseResult = await parseRuleWithFallback(text);

  if (!parseResult.success) {
    return res.status(422).json({
      success: false,
      error: parseResult.error,
    });
  }

  const rule = parseResult.rule;

  try {
    const transactions = buildTransactionsFromRule(streamId, rule);

    if (relay) {
      const relayResults = [];

      for (const transaction of transactions) {
        const result = await sendInlineTransaction(
          transaction.code,
          transaction.args.map((arg) => arg.value)
        );

        relayResults.push({
          description: transaction.description,
          transactionId: extractTransactionId(result),
          raw: result,
        });
      }

      return res.json({
        success: true,
        mode: 'relay',
        rule,
        description: describeRule(rule),
        relayResults,
      });
    }

    return res.json({
      success: true,
      mode: 'client',
      rule,
      description: describeRule(rule),
      transactions: transactions.map(t => ({
        code: t.code,
        args: t.args,
        description: t.description,
      })),
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
  const transactionCode = withCadenceImports(`
import FlowPilotVault from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import WorkCredential from 0x0000000000000000
import RuleGraph from 0x0000000000000000

transaction(streamId: String, workerAddress: Address, ratePerSecond: UFix64, yieldSplitRatio: UFix64, milestoneIntervalDays: UFix64, initialFundingAmount: UFix64, workerRole: String) {
  prepare(employer: auth(Storage, Capabilities) &Account) {
    // Implementation in CreateStream.cdc
        log("Stream created: ".concat(streamId))
  }
}`);

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

app.post('/api/claim-balance', async (req: Request, res: Response) => {
  const { streamId, amount } = req.body;

  if (!streamId || !amount) {
    return res.status(400).json({ success: false, error: 'streamId and amount are required' });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/ClaimBalance.cdc'),
      [streamId, Number(amount).toFixed(8)]
    );

    res.json({
      success: true,
      transactionId: extractTransactionId(result),
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/lottery/deposit', async (req: Request, res: Response) => {
  const { poolId, amount } = req.body;

  if (!poolId || !amount) {
    return res.status(400).json({ success: false, error: 'poolId and amount are required' });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/DepositLottery.cdc'),
      [poolId, Number(amount).toFixed(8)]
    );

    res.json({ success: true, transactionId: extractTransactionId(result), result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/lottery/draw', async (req: Request, res: Response) => {
  const { poolId } = req.body;

  if (!poolId) {
    return res.status(400).json({ success: false, error: 'poolId is required' });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/DrawLottery.cdc'),
      [poolId]
    );

    res.json({ success: true, transactionId: extractTransactionId(result), result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/giftcards/mint', async (req: Request, res: Response) => {
  const { vaultId, recipientAddress, message, targetDate = 0, principalAmount } = req.body;

  if (!vaultId || !recipientAddress || !message || !principalAmount) {
    return res.status(400).json({
      success: false,
      error: 'vaultId, recipientAddress, message, and principalAmount are required',
    });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/MintGiftCard.cdc'),
      [
        vaultId,
        recipientAddress,
        message,
        Number(targetDate).toFixed(1),
        Number(principalAmount).toFixed(8),
      ]
    );

    res.json({ success: true, transactionId: extractTransactionId(result), result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/giftcards/redeem', async (req: Request, res: Response) => {
  const { cardId, streamId } = req.body;

  if (cardId === undefined || !streamId) {
    return res.status(400).json({ success: false, error: 'cardId and streamId are required' });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/RedeemGiftCard.cdc'),
      [cardId, streamId]
    );

    res.json({ success: true, transactionId: extractTransactionId(result), result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/subscriptions/create', async (req: Request, res: Response) => {
  const {
    subscriptionId,
    payeeAddress,
    amount,
    intervalSeconds,
    maxPayments = 0,
    description,
    vaultId,
  } = req.body;

  if (!subscriptionId || !payeeAddress || !amount || !intervalSeconds || !description || !vaultId) {
    return res.status(400).json({
      success: false,
      error: 'subscriptionId, payeeAddress, amount, intervalSeconds, description, and vaultId are required',
    });
  }

  try {
    const result = await sendTransactionFile(
      path.resolve(__dirname, '../../cadence/transactions/CreateSubscription.cdc'),
      [
        subscriptionId,
        payeeAddress,
        Number(amount).toFixed(8),
        Number(intervalSeconds).toFixed(1),
        Number(maxPayments).toFixed(0),
        description,
        vaultId,
      ]
    );

    res.json({ success: true, transactionId: extractTransactionId(result), result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlowPilot Backend running on port ${PORT}`);
  console.log(`Network: ${process.env.VITE_FLOW_NETWORK ?? 'testnet'}`);
  console.log(`Managed signer: ${process.env.FLOW_TESTNET_ACCOUNT_NAME ?? 'flowpilot-testnet'}`);
});

export default app;
