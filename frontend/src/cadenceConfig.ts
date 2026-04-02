import { DEPLOYMENT_SNAPSHOT_STATE } from './lib/deploymentState';

const PLACEHOLDER_ADDRESS = '0x0000000000000000';
const PLACEHOLDER_IMPORT_PATTERN = new RegExp(
  `(import\\s+[^\\n]+?\\s+from\\s+)${PLACEHOLDER_ADDRESS}`,
  'g'
);

export function normalizeFlowAddress(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error(`Invalid Flow address: ${value}`);
  }

  return `0x${normalized}`;
}

export function safeNormalizeFlowAddress(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  try {
    return normalizeFlowAddress(value);
  } catch {
    return '';
  }
}

export function getCadenceContractAddress(): string {
  const configuredAddress =
    import.meta.env.VITE_FLOW_CONTRACT_ADDRESS ??
    DEPLOYMENT_SNAPSHOT_STATE.cadence?.contractAddress ??
    '';

  if (!configuredAddress) {
    throw new Error(
      'Missing VITE_FLOW_CONTRACT_ADDRESS. Deploy the Cadence contracts and add the deployed address to the frontend environment.'
    );
  }

  return normalizeFlowAddress(configuredAddress);
}

export function withCadenceImports(cadence: string): string {
  return cadence.replace(PLACEHOLDER_IMPORT_PATTERN, `$1${getCadenceContractAddress()}`);
}

export function getDashboardStreamId(): string {
  return (
    import.meta.env.VITE_FLOW_DASHBOARD_STREAM_ID ??
    DEPLOYMENT_SNAPSHOT_STATE.cadence?.streamId ??
    ''
  );
}

export function getSeededDashboardAccount(): string {
  return safeNormalizeFlowAddress(
    import.meta.env.VITE_FLOW_DASHBOARD_ACCOUNT_ADDRESS ??
      DEPLOYMENT_SNAPSHOT_STATE.cadence?.accountAddress ??
      ''
  );
}
