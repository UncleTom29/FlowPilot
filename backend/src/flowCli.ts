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
const FRONTEND_DEPLOYMENT_SNAPSHOT_PATH = path.join(
  ROOT_DIR,
  'frontend',
  'src',
  'generated',
  'demoDeploymentState.json'
);
const FLOW_BIN =
  process.env.FLOW_BIN ||
  (process.platform === 'darwin' ? '/opt/homebrew/bin/flow' : 'flow');
const FLOW_NETWORK = 'testnet';
const FLOW_ACCESS_NODE = process.env.FLOW_ACCESS_NODE || 'access.devnet.nodes.onflow.org:9000';

function normalizeFlowAddress(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error(`Invalid Flow address: ${value}`);
  }

  return normalized;
}

function normalizePrivateKey(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('Invalid Flow private key: expected a 64-byte hex string');
  }

  return normalized.toLowerCase();
}

async function writeFlowConfigFromEnv() {
  const address = process.env.FLOW_TESTNET_ADDRESS;
  const key = process.env.FLOW_TESTNET_KEY;
  const accountName = process.env.FLOW_TESTNET_ACCOUNT_NAME || 'flowpilot-testnet';

  if (!address || !key) {
    throw new Error(
      'Missing Flow signer configuration. Set FLOW_TESTNET_ADDRESS and FLOW_TESTNET_KEY for the managed relay.'
    );
  }

  await fs.mkdir(path.dirname(FLOW_CONFIG_PATH), { recursive: true });
  await fs.writeFile(
    FLOW_CONFIG_PATH,
    `${JSON.stringify(
      {
        networks: {
          [FLOW_NETWORK]: FLOW_ACCESS_NODE,
        },
        accounts: {
          [accountName]: {
            address: normalizeFlowAddress(address),
            key: normalizePrivateKey(key),
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function ensureConfigured() {
  try {
    await fs.access(FLOW_CONFIG_PATH);
  } catch {
    await writeFlowConfigFromEnv();
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

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
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
      FLOW_NETWORK,
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
  const [cadenceDeployment, evmDeployment, snapshot] = await Promise.all([
    readJsonOrNull<Record<string, unknown>>(path.join(DEPLOYMENTS_DIR, 'cadence-testnet.json')),
    readJsonOrNull<Record<string, unknown>>(path.join(DEPLOYMENTS_DIR, 'evm-deployments.json')),
    readJsonOrNull<{
      cadence?: Record<string, unknown> | null;
      evm?: Record<string, unknown> | null;
      signer?: string;
      ready?: boolean;
      generatedAt?: string;
    }>(FRONTEND_DEPLOYMENT_SNAPSHOT_PATH),
  ]);

  const cadence = cadenceDeployment ?? snapshot?.cadence ?? null;
  const evm = evmDeployment ?? snapshot?.evm ?? null;

  return {
    cadence,
    evm,
    signer: snapshot?.signer ?? signer,
    ready: Boolean(cadence ?? snapshot?.ready),
    accessNode: FLOW_ACCESS_NODE,
    relayReady: Boolean(process.env.FLOW_TESTNET_ADDRESS && process.env.FLOW_TESTNET_KEY),
    generatedAt: snapshot?.generatedAt,
  };
}
