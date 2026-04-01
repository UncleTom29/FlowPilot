const PLACEHOLDER_ADDRESS = '0x0000000000000000';
const PLACEHOLDER_IMPORT_PATTERN = new RegExp(
  `(import\\s+[^\\n]+?\\s+from\\s+)${PLACEHOLDER_ADDRESS}`,
  'g'
);

function normalizeFlowAddress(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error(`Invalid Flow contract address: ${value}`);
  }

  return `0x${normalized}`;
}

export function getCadenceContractAddress(): string {
  const configuredAddress =
    process.env.FLOW_CONTRACT_ADDRESS ?? process.env.FLOW_TESTNET_ADDRESS;

  if (!configuredAddress) {
    return PLACEHOLDER_ADDRESS;
  }

  return normalizeFlowAddress(configuredAddress);
}

export function withCadenceImports(cadence: string): string {
  return cadence.replace(PLACEHOLDER_IMPORT_PATTERN, `$1${getCadenceContractAddress()}`);
}
