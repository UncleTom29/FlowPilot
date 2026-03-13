import * as fcl from '@onflow/fcl';

// ─────────────────────────────────────────────────────────────────────────────
// Gasless transaction sender for FlowPilot
// ─────────────────────────────────────────────────────────────────────────────

const PAYMASTER_ADDRESS = process.env.FLOW_PAYMASTER_ADDRESS ?? '';
const PAYMASTER_KEY = process.env.FLOW_PAYMASTER_KEY ?? '';

/**
 * Paymaster authorization function for FCL.
 * The paymaster account covers all transaction fees so users never pay gas.
 * Private key is environment-injected — never hardcoded.
 */
async function paymasterAuthz(account: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!PAYMASTER_ADDRESS || !PAYMASTER_KEY) {
    console.warn('[GaslessSender] FLOW_PAYMASTER_ADDRESS or FLOW_PAYMASTER_KEY not set');
  }

  // In production: use Flow's account key signing with the paymaster account
  // The paymaster covers the fee without seeing or controlling user funds
  return {
    ...account,
    addr: PAYMASTER_ADDRESS,
    keyId: 0,
    signingFunction: async (signable: { message: string }) => {
      // Sign using the paymaster's private key (env-injected)
      // In production: use Flow's service account signing or a KMS
      const sig = await signWithPaymasterKey(signable.message);
      return {
        addr: PAYMASTER_ADDRESS,
        keyId: 0,
        signature: sig,
      };
    },
  };
}

/**
 * Signs a message with the paymaster private key.
 * In production this should use a KMS or HSM — never raw key in memory.
 */
async function signWithPaymasterKey(message: string): Promise<string> {
  // Placeholder: real implementation uses @onflow/fcl signer or KMS
  return '';
}

export interface GaslessMutateOptions {
  cadenceCode: string;
  args: Array<{ type: string; value: unknown }>;
  userAuthz: unknown;  // User's FCL authorization (for signing intent only)
  proposer?: unknown;  // Defaults to user
}

/**
 * Send a Cadence transaction with gasless fee delegation.
 * The user's authz is only for authorization (signing intent).
 * The paymaster authz covers all transaction fees.
 */
export async function sendGaslessTransaction(
  options: GaslessMutateOptions
): Promise<string> {
  const { cadenceCode, args, userAuthz } = options;

  const txId = await fcl.mutate({
    cadence: cadenceCode,
    args: (arg: unknown, t: unknown) => args.map(({ type, value }) =>
      (arg as Function)(value, (t as Record<string, Function>)[type]())
    ),
    payer: paymasterAuthz,        // Protocol covers gas
    proposer: userAuthz,          // User proposes and authorizes
    authorizations: [userAuthz],  // User is the only authorizer
    limit: 9999,
  });

  console.log(`[GaslessSender] Transaction submitted: ${txId}`);
  return txId;
}

/**
 * Send a gasless EVM transaction via Flow's EVM gasless endpoint.
 * Routes through the Flow EVM Gateway service account.
 */
export async function sendGaslessEVMTransaction(
  contractAddress: string,
  data: string,
  value: bigint = 0n
): Promise<string> {
  // In production: submit via Flow EVM gasless relay endpoint
  // POST https://evm-gateway.testnet.onflow.org/gasless
  // with signed EIP-712 typed data
  const evmGatewayUrl = process.env.EVM_GASLESS_GATEWAY_URL ??
    'https://evm-gateway.testnet.onflow.org/gasless';

  console.log(`[GaslessSender] Sending EVM tx to ${contractAddress} via ${evmGatewayUrl}`);

  // Placeholder — real implementation sends signed EIP-712 meta-transaction
  return '0x' + '0'.repeat(64);
}

export { paymasterAuthz };
