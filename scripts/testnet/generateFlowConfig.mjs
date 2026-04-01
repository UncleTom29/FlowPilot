import {
  TESTNET_DIR,
  TESTNET_FLOW_CONFIG_PATH,
  buildTestnetFlowConfig,
  ensureDir,
  findReusableTestnetAccount,
  loadEffectiveEnv,
  writeJson,
} from './shared.mjs';

const env = loadEffectiveEnv();
const accountName = env.FLOW_TESTNET_ACCOUNT_NAME || 'flowpilot-testnet';
const account = findReusableTestnetAccount(env, accountName);

if (!account) {
  throw new Error(
    'No reusable Flow testnet account was found. Set FLOW_TESTNET_ADDRESS/FLOW_TESTNET_KEY or run `npm run deploy:testnet:all` to create one through the Flow CLI.'
  );
}

ensureDir(TESTNET_DIR);
writeJson(
  TESTNET_FLOW_CONFIG_PATH,
  buildTestnetFlowConfig({
    accountName: account.name,
    address: account.address,
    key: account.key,
  })
);

console.log(TESTNET_FLOW_CONFIG_PATH);
