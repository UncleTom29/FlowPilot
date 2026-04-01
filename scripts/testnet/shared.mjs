import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '../..');
export const ENV_PATH = path.join(ROOT_DIR, '.env');
export const FLOW_CONFIG_PATH = path.join(ROOT_DIR, 'flow.json');
export const PRIVATE_TESTNET_CONFIG_PATH = path.join(ROOT_DIR, 'flow-tester.private.json');
export const TESTNET_DIR = path.join(ROOT_DIR, '.flow');
export const TESTNET_FLOW_CONFIG_PATH = path.join(TESTNET_DIR, 'testnet.flow.json');
export const HOME_FLOW_CONFIG_PATH = path.join(os.homedir(), 'flow.json');
export const DEPLOYMENTS_DIR = path.join(ROOT_DIR, 'deployments');
export const FLOW_BIN = fs.existsSync('/opt/homebrew/bin/flow') ? '/opt/homebrew/bin/flow' : 'flow';
const PLACEHOLDER_ADDRESS = '0x0000000000000000';
const PLACEHOLDER_IMPORT_PATTERN = new RegExp(
  `(import\\s+[^\\n]+?\\s+from\\s+)${PLACEHOLDER_ADDRESS}`,
  'g'
);
const EXCLUDED_TESTNET_CONTRACTS = new Set([
  'AIRebalanceHandler',
  'DCAHandler',
  'LotteryDrawHandler',
  'MilestoneHandler',
  'SubscriptionHandler',
  'YieldRebalanceHandler',
]);

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseEnvFile(filePath = ENV_PATH) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

export function loadEffectiveEnv() {
  return {
    ...parseEnvFile(),
    ...process.env,
  };
}

export function normalizeFlowAddress(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^0x/i, '')
    .toLowerCase();

  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error(`Invalid Flow address: ${value}`);
  }

  return normalized;
}

export function toFlowHexAddress(value) {
  return `0x${normalizeFlowAddress(value)}`;
}

export function withCadenceImportsForAddress(cadence, address) {
  return cadence.replace(PLACEHOLDER_IMPORT_PATTERN, `$1${toFlowHexAddress(address)}`);
}

export function prepareCadenceFile(sourcePath, targetPath, address) {
  ensureDir(path.dirname(targetPath));
  const code = fs.readFileSync(sourcePath, 'utf8');
  fs.writeFileSync(targetPath, withCadenceImportsForAddress(code, address));
  return targetPath;
}

export function normalizePrivateKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('Invalid Flow private key: expected a 64-byte hex string');
  }

  return normalized.toLowerCase();
}

function resolveKeyMaterial(keyValue, configPath) {
  const resolvedValue =
    typeof keyValue === 'object' && keyValue !== null
      ? keyValue.privateKey ?? keyValue.key ?? keyValue.path ?? keyValue.file
      : keyValue;

  if (typeof resolvedValue !== 'string' || resolvedValue.trim() === '') {
    throw new Error(`Unsupported Flow account key format in ${configPath}`);
  }

  const trimmed = resolvedValue.trim();
  const candidatePaths = [
    trimmed,
    path.resolve(path.dirname(configPath), trimmed),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePrivateKey(fs.readFileSync(candidate, 'utf8'));
    }
  }

  return normalizePrivateKey(trimmed);
}

function accountFromConfig(configPath, preferredName) {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const config = readJson(configPath);
  const accounts = config.accounts ?? {};
  const accountNames = Object.keys(accounts);

  const selectedName =
    (preferredName && accounts[preferredName] ? preferredName : null) ??
    accountNames.find((name) => name !== 'emulator-account');

  if (!selectedName) {
    return null;
  }

  const record = accounts[selectedName];

  return {
    name: selectedName,
    address: normalizeFlowAddress(record.address),
    key: resolveKeyMaterial(record.key, configPath),
  };
}

export function findReusableTestnetAccount(env, preferredName) {
  if (env.FLOW_TESTNET_ADDRESS && env.FLOW_TESTNET_KEY) {
    return {
      name: preferredName,
      address: normalizeFlowAddress(env.FLOW_TESTNET_ADDRESS),
      key: normalizePrivateKey(env.FLOW_TESTNET_KEY),
    };
  }

  return (
    accountFromConfig(PRIVATE_TESTNET_CONFIG_PATH, preferredName) ??
    accountFromConfig(TESTNET_FLOW_CONFIG_PATH, preferredName) ??
    accountFromConfig(HOME_FLOW_CONFIG_PATH, preferredName)
  );
}

export function prepareCadenceContractsForAddress(address, targetRoot = path.join(TESTNET_DIR, 'prepared-cadence')) {
  const baseConfig = readJson(FLOW_CONFIG_PATH);

  return Object.fromEntries(
    Object.entries(baseConfig.contracts).map(([name, contractPath]) => {
      if (typeof contractPath !== 'string') {
        return [name, contractPath];
      }

      const sourcePath = path.resolve(ROOT_DIR, contractPath);
      const relativeSourcePath = path.relative(ROOT_DIR, sourcePath);
      const preparedPath = path.join(targetRoot, relativeSourcePath);

      prepareCadenceFile(sourcePath, preparedPath, address);

      return [name, path.relative(TESTNET_DIR, preparedPath)];
    })
  );
}

export function buildBaseTestnetConfig({ contracts } = {}) {
  const baseConfig = readJson(FLOW_CONFIG_PATH);
  const resolvedContracts = contracts ?? Object.fromEntries(
    Object.entries(baseConfig.contracts).map(([name, contractPath]) => [
      name,
      typeof contractPath === 'string'
        ? path.relative(TESTNET_DIR, path.resolve(ROOT_DIR, contractPath))
        : contractPath,
    ])
  );
  return {
    networks: baseConfig.networks,
    accounts: {},
    contracts: resolvedContracts,
    deployments: {},
  };
}

export function buildTestnetFlowConfig({ accountName, address, key, contracts }) {
  const baseConfig = buildBaseTestnetConfig({ contracts });
  const deployedContracts = Object.keys(baseConfig.contracts).filter(
    (contractName) => !EXCLUDED_TESTNET_CONTRACTS.has(contractName)
  );
  return {
    ...baseConfig,
    accounts: {
      [accountName]: {
        address: normalizeFlowAddress(address),
        key: normalizePrivateKey(key),
      },
    },
    deployments: {
      testnet: {
        [accountName]: deployedContracts,
      },
    },
  };
}

export function upsertEnvFile(updates, filePath = ENV_PATH) {
  const existingLines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    : [];

  const remaining = new Map(
    Object.entries(updates).map(([key, value]) => [key, String(value)])
  );

  const nextLines = existingLines.map((line) => {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      return line;
    }

    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();

    if (!remaining.has(key)) {
      return line;
    }

    const value = remaining.get(key);
    remaining.delete(key);
    return `${key}=${value}`;
  });

  if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
    nextLines.push('');
  }

  for (const [key, value] of remaining.entries()) {
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${nextLines.join('\n').replace(/\n*$/, '\n')}`);
}

export function runCommand(command, args, options = {}) {
  const resolvedCommand = command === 'flow' ? FLOW_BIN : command;
  const result = spawnSync(resolvedCommand, args, {
    cwd: options.cwd ?? ROOT_DIR,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: 'utf8',
    stdio: options.inheritStdio ? 'inherit' : 'pipe',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `${resolvedCommand} ${args.join(' ')} failed`);
  }

  return result;
}

export function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
