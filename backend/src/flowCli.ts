import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { withCadenceImports } from './cadenceImports';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '../..');
const FLOW_CONFIG_PATH = path.join(ROOT_DIR, '.flow', 'testnet.flow.json');
const DEPLOYMENTS_DIR = path.join(ROOT_DIR, 'deployments');
const FLOW_BIN = '/opt/homebrew/bin/flow';

async function ensureConfigured() {
  try {
    await fs.access(FLOW_CONFIG_PATH);
  } catch {
    throw new Error('Missing .flow/testnet.flow.json. Run npm run deploy:testnet first.');
  }
}

async function resolveDefaultSigner(): Promise<string> {
  if (process.env.FLOW_TESTNET_ACCOUNT_NAME) {
    return process.env.FLOW_TESTNET_ACCOUNT_NAME;
  }

  try {
    const config = JSON.parse(await fs.readFile(FLOW_CONFIG_PATH, 'utf8')) as {
      accounts?: Record<string, unknown>;
    };
    const [firstAccount] = Object.keys(config.accounts ?? {});
    if (firstAccount) {
      return firstAccount;
    }
  } catch {
    // Fall through to the legacy default below.
  }

  return 'flowpilot-testnet';
}

function normalizeArgs(args: unknown[]): string[] {
  return args.map((value) => String(value));
}

function assertSuccessfulFlowResult(result: unknown) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const record = result as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim().length > 0) {
    throw new Error(record.error);
  }

  return result;
}

async function runFlow(args: string[]) {
  await ensureConfigured();

  const { stdout, stderr } = await execFileAsync(FLOW_BIN, args, {
    cwd: ROOT_DIR,
    maxBuffer: 1024 * 1024,
  });

  const trimmed = stdout.trim() || stderr.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }

  return assertSuccessfulFlowResult(parsed);
}

async function withPreparedCadenceFile<T>(sourcePath: string, run: (preparedPath: string) => Promise<T>) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowpilot-cadence-'));
  const preparedPath = path.join(tempDir, path.basename(sourcePath));

  try {
    const code = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(preparedPath, withCadenceImports(code), 'utf8');
    return await run(preparedPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export function extractTransactionId(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (typeof record.id === 'string') {
    return record.id;
  }
  if (typeof record.transactionId === 'string') {
    return record.transactionId;
  }

  const transaction = record.transaction;
  if (transaction && typeof transaction === 'object') {
    const txRecord = transaction as Record<string, unknown>;
    if (typeof txRecord.id === 'string') {
      return txRecord.id;
    }
  }

  return null;
}

export async function sendTransactionFile(
  transactionPath: string,
  args: unknown[],
  signer?: string
) {
  const signerName = signer ?? await resolveDefaultSigner();

  return withPreparedCadenceFile(transactionPath, (preparedPath) =>
    runFlow([
      'transactions',
      'send',
      preparedPath,
      ...normalizeArgs(args),
      '--config-path',
      FLOW_CONFIG_PATH,
      '--network',
      'testnet',
      '--signer',
      signerName,
      '--gas-limit',
      '9999',
      '--output',
      'json',
    ])
  );
}

export async function sendInlineTransaction(
  code: string,
  args: unknown[],
  signer?: string
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowpilot-tx-'));
  const tempFile = path.join(tempDir, 'transaction.cdc');

  try {
    await fs.writeFile(tempFile, withCadenceImports(code), 'utf8');
    return await sendTransactionFile(tempFile, args, signer);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function getDeploymentState() {
  const signer = await resolveDefaultSigner();
  const [cadence, evm] = await Promise.all([
    fs.readFile(path.join(DEPLOYMENTS_DIR, 'cadence-testnet.json'), 'utf8').then(JSON.parse).catch(() => null),
    fs.readFile(path.join(DEPLOYMENTS_DIR, 'evm-deployments.json'), 'utf8').then(JSON.parse).catch(() => null),
  ]);

  return {
    cadence,
    evm,
    signer,
    ready: Boolean(cadence),
  };
}
