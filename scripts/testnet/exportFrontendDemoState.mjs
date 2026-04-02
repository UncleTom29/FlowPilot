import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPLOYMENTS_DIR,
  ROOT_DIR,
  ensureDir,
  readJson,
  writeJson,
} from './shared.mjs';

const __filename = fileURLToPath(import.meta.url);
const FRONTEND_GENERATED_STATE_PATH = path.join(
  ROOT_DIR,
  'frontend',
  'src',
  'generated',
  'demoDeploymentState.json'
);

function readJsonOrNull(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function summarizeCadenceVerification(verification) {
  const vaultFields = verification?.vaultState?.value?.fields ?? [];
  const lotteryFields = verification?.lotteryPool?.value?.fields ?? [];
  const workCredentialFields = verification?.workCredential?.value?.fields ?? [];
  const portfolioFields = verification?.portfolio?.value?.fields ?? [];

  const readField = (fields, name) => {
    const field = fields.find((entry) => entry?.name === name);
    return field?.value?.value ?? field?.value ?? null;
  };

  return {
    claimableTotal: readField(vaultFields, 'claimableTotal'),
    salaryAccrued: readField(vaultFields, 'salaryAccrued'),
    yieldPrincipal: readField(vaultFields, 'yieldPrincipal'),
    yieldEarned: readField(vaultFields, 'yieldEarned'),
    lotteryYieldAccumulated: readField(lotteryFields, 'yieldAccumulated'),
    lotteryParticipants: readField(lotteryFields, 'participantCount'),
    portfolioRiskProfile: readField(portfolioFields, 'riskProfile'),
    creditScore: readField(workCredentialFields, 'creditScore'),
    averageAPY: readField(workCredentialFields, 'averageAPY'),
  };
}

function buildFrontendDemoState() {
  const cadence = readJsonOrNull(path.join(DEPLOYMENTS_DIR, 'cadence-testnet.json'));
  const evm = readJsonOrNull(path.join(DEPLOYMENTS_DIR, 'evm-deployments.json'));

  return {
    cadence: cadence
      ? {
          accountAddress: cadence.accountAddress,
          contractAddress: cadence.contractAddress,
          streamId: cadence.streamId,
          poolId: cadence.poolId,
          portfolioId: cadence.portfolioId,
          subscriptionId: cadence.subscriptionId,
          seededAt: cadence.seededAt,
          activity: Array.isArray(cadence.activity) ? cadence.activity.slice(0, 32) : [],
          surfacedFeatures: cadence.surfacedFeatures ?? {},
          verificationSummary: summarizeCadenceVerification(cadence.verification),
        }
      : null,
    evm: evm
      ? {
          seedData: evm.seedData ?? {},
          contracts: evm.contracts ?? {},
        }
      : null,
    signer: cadence?.accountName ?? 'bundled-demo',
    ready: Boolean(cadence),
    generatedAt: new Date().toISOString(),
  };
}

export function syncFrontendDemoState() {
  const state = buildFrontendDemoState();
  ensureDir(path.dirname(FRONTEND_GENERATED_STATE_PATH));
  writeJson(FRONTEND_GENERATED_STATE_PATH, state);
  return state;
}

if (process.argv[1] === __filename) {
  const state = syncFrontendDemoState();
  console.log(
    JSON.stringify(
      {
        ready: state.ready,
        path: FRONTEND_GENERATED_STATE_PATH,
        accountAddress: state.cadence?.accountAddress ?? null,
        contractAddress: state.cadence?.contractAddress ?? null,
      },
      null,
      2
    )
  );
}
