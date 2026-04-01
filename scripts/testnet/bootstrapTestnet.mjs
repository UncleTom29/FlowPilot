import path from 'node:path';
import {
  DEPLOYMENTS_DIR,
  ROOT_DIR,
  TESTNET_DIR,
  TESTNET_FLOW_CONFIG_PATH,
  buildBaseTestnetConfig,
  buildTestnetFlowConfig,
  ensureDir,
  findReusableTestnetAccount,
  loadEffectiveEnv,
  prepareCadenceContractsForAddress,
  prepareCadenceFile,
  readJson,
  runCommand,
  toFlowHexAddress,
  tryParseJson,
  upsertEnvFile,
  writeJson,
} from './shared.mjs';

const args = new Set(process.argv.slice(2));
const cadenceOnly = args.has('--cadence-only');
const seedOnly = args.has('--seed-only');
const PREPARED_CADENCE_ROOT = path.join(TESTNET_DIR, 'prepared-cadence');

function logStep(message) {
  console.log(`\n==> ${message}`);
}

function ensureTestnetAccount(env, preferredName) {
  const existing = findReusableTestnetAccount(env, preferredName);
  if (existing) {
    return existing;
  }

  ensureDir(TESTNET_DIR);
  writeJson(TESTNET_FLOW_CONFIG_PATH, buildBaseTestnetConfig());

  logStep('No reusable Flow testnet account found. Creating one with Flow CLI');
  console.log('The CLI may prompt you for an account name before funding the new testnet account.');

  runCommand(
    'flow',
    ['accounts', 'create', '--config-path', TESTNET_FLOW_CONFIG_PATH, '--network', 'testnet'],
    { inheritStdio: true }
  );

  const created = findReusableTestnetAccount(loadEffectiveEnv(), preferredName);
  if (!created) {
    throw new Error('Flow CLI account creation completed, but no reusable testnet account could be resolved');
  }

  return created;
}

function getPreparedCadencePath(relativePath, address) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  const preparedPath = path.join(PREPARED_CADENCE_ROOT, relativePath);
  return prepareCadenceFile(sourcePath, preparedPath, address);
}

function writeTestnetFlowConfig(account) {
  ensureDir(TESTNET_DIR);
  const contracts = prepareCadenceContractsForAddress(account.address, PREPARED_CADENCE_ROOT);
  writeJson(
    TESTNET_FLOW_CONFIG_PATH,
    buildTestnetFlowConfig({
      accountName: account.name,
      address: account.address,
      key: account.key,
      contracts,
    })
  );
}

function deployCadence(accountName) {
  logStep('Deploying Cadence contracts to Flow testnet');

  const baseArgs = [
    'project',
    'deploy',
    '--config-path',
    TESTNET_FLOW_CONFIG_PATH,
    '--network',
    'testnet',
    '--output',
    'json',
  ];

  try {
    const result = runCommand('flow', baseArgs);
    return tryParseJson(result.stdout) ?? { raw: result.stdout.trim() };
  } catch (error) {
    logStep('Retrying Cadence deployment with --update');

    try {
      const result = runCommand('flow', [...baseArgs, '--update']);
      return tryParseJson(result.stdout) ?? { raw: result.stdout.trim() };
    } catch (updateError) {
      throw updateError instanceof Error ? updateError : error;
    }
  }
}

function assertSuccessfulFlowResult(result) {
  if (result && typeof result === 'object' && typeof result.error === 'string' && result.error.trim()) {
    throw new Error(result.error);
  }

  return result;
}

function sendFlowTransaction(filename, txArgs, signer, address) {
  const transactionPath = getPreparedCadencePath(path.join('cadence', 'transactions', filename), address);
  const result = runCommand('flow', [
    'transactions',
    'send',
    transactionPath,
    ...txArgs.map(String),
    '--config-path',
    TESTNET_FLOW_CONFIG_PATH,
    '--network',
    'testnet',
    '--signer',
    signer,
    '--gas-limit',
    '9999',
    '--output',
    'json',
  ]);

  return assertSuccessfulFlowResult(tryParseJson(result.stdout) ?? { raw: result.stdout.trim() });
}

function trySendFlowTransaction(filename, txArgs, signer, address, ignorePattern = /already exists|already stores an object/i) {
  try {
    return sendFlowTransaction(filename, txArgs, signer, address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ignorePattern.test(message)) {
      return { skipped: true, reason: message };
    }
    throw error;
  }
}

function executeFlowScript(filename, scriptArgs, address) {
  const scriptPath = getPreparedCadencePath(path.join('cadence', 'scripts', filename), address);
  const result = runCommand('flow', [
    'scripts',
    'execute',
    scriptPath,
    ...scriptArgs.map(String),
    '--config-path',
    TESTNET_FLOW_CONFIG_PATH,
    '--network',
    'testnet',
    '--output',
    'json',
  ]);

  return assertSuccessfulFlowResult(tryParseJson(result.stdout) ?? { raw: result.stdout.trim() });
}

function extractTransactionId(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  if (typeof result.id === 'string') {
    return result.id;
  }

  if (typeof result.transactionId === 'string') {
    return result.transactionId;
  }

  if (result.transaction && typeof result.transaction.id === 'string') {
    return result.transaction.id;
  }

  return null;
}

function buildActivity(title, category, result, metadata = {}) {
  const txId = extractTransactionId(result);
  return {
    title,
    category,
    txId,
    explorerUrl: txId ? `https://testnet.flowscan.io/transaction/${txId}` : null,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
}

function seedCadenceDashboard(account, env) {
  const streamId = env.FLOW_DASHBOARD_STREAM_ID || 'default';
  const initialDeposit = env.FLOW_DASHBOARD_INITIAL_DEPOSIT || '600.00000000';
  const additionalPrincipal = env.FLOW_DASHBOARD_ADDITIONAL_PRINCIPAL || '180.00000000';
  const salaryRate = env.FLOW_DASHBOARD_SALARY_RATE || '0.00077200';
  const elapsedSeconds = env.FLOW_DASHBOARD_ELAPSED_SECONDS || '15552000.0';
  const harvestedYield = env.FLOW_DASHBOARD_HARVESTED_YIELD || '24.50000000';
  const poolId = env.FLOW_DASHBOARD_LOTTERY_ID || 'primary-pool';
  const portfolioId = env.FLOW_DASHBOARD_PORTFOLIO_ID || 'core-portfolio';
  const subscriptionId = `subscription_${Date.now()}`;
  const walletAddress = toFlowHexAddress(account.address);
  const activity = [];
  const sendTransaction = (filename, txArgs) =>
    sendFlowTransaction(filename, txArgs, account.name, account.address);
  const trySendTransaction = (filename, txArgs, ignorePattern) =>
    trySendFlowTransaction(filename, txArgs, account.name, account.address, ignorePattern);
  const executeScript = (filename, scriptArgs) => executeFlowScript(filename, scriptArgs, account.address);

  logStep(`Seeding dashboard state for stream "${streamId}"`);

  const createStreamResult = trySendTransaction(
    'CreateStream.cdc',
    [
      streamId,
      walletAddress,
      salaryRate,
      '0.80000000',
      '30.0',
      initialDeposit,
      'Autonomous Flow operator',
    ]
  );

  activity.push(
    buildActivity('Initialized autonomous payroll stream', 'stream', createStreamResult, {
      streamId,
    })
  );

  const seedResult = sendTransaction(
    'SeedDashboardState.cdc',
    [streamId, additionalPrincipal, salaryRate, elapsedSeconds, harvestedYield]
  );
  activity.push(
    buildActivity('Harvested yield and advanced dashboard balances', 'yield', seedResult, {
      streamId,
    })
  );

  const timestampSuffix = Date.now();
  const ruleDefinitions = [
    {
      id: `rule_savings_${timestampSuffix}`,
      ruleType: 'savings_split',
      ruleParams: '{"type":"savings_split","params":{"ratio":0.25,"targetProtocol":"FlowYield"}}',
      rawText: 'Route 25% of every claim into the high-yield reserve.',
      hasScheduler: 'false',
      interval: '0.0',
      title: 'Activated reserve autopilot',
    },
    {
      id: `rule_dca_${timestampSuffix}`,
      ruleType: 'dca',
      ruleParams: '{"type":"dca","params":{"fromAsset":"USDC","toAsset":"FLOW","amount":50,"interval":"weekly"}}',
      rawText: 'Buy $50 of FLOW every week from stablecoin reserves.',
      hasScheduler: 'true',
      interval: '604800.0',
      title: 'Started weekly FLOW DCA',
    },
    {
      id: `rule_subscription_${timestampSuffix}`,
      ruleType: 'subscription',
      ruleParams: '{"type":"subscription","params":{"amount":32,"interval":"monthly","merchant":"Treasury Circle"}}',
      rawText: 'Pay 32 FLOW every month to Treasury Circle.',
      hasScheduler: 'true',
      interval: '2592000.0',
      title: 'Registered monthly treasury membership',
    },
    {
      id: `rule_roundup_${timestampSuffix}`,
      ruleType: 'roundup',
      ruleParams: '{"type":"roundup","params":{"bucketSize":1.0}}',
      rawText: 'Round every spending event up to the nearest whole FLOW and save the delta.',
      hasScheduler: 'false',
      interval: '0.0',
      title: 'Enabled roundup reserve',
    },
    {
      id: `rule_portfolio_${timestampSuffix}`,
      ruleType: 'portfolio',
      ruleParams: '{"type":"portfolio","params":{"riskProfile":"moderate","rebalance":"daily"}}',
      rawText: 'Keep the treasury portfolio in a moderate risk profile and rebalance daily.',
      hasScheduler: 'true',
      interval: '86400.0',
      title: 'Pinned AI portfolio guardrails',
    },
  ];

  const ruleResults = ruleDefinitions.map((rule) => {
    const result = sendTransaction(
      'AddRule.cdc',
      [
        streamId,
        rule.id,
        rule.ruleType,
        rule.ruleParams,
        rule.rawText,
        rule.hasScheduler,
        rule.interval,
      ]
    );

    activity.push(buildActivity(rule.title, 'rule', result, { ruleId: rule.id }));
    return result;
  });

  const initLotteryResult = trySendTransaction('InitLotteryPool.cdc', [poolId]);
  activity.push(buildActivity('Provisioned lossless lottery pool', 'lottery', initLotteryResult, { poolId }));

  const lotteryDepositResult = sendTransaction('DepositLottery.cdc', [poolId, '75.00000000']);
  activity.push(buildActivity('Deposited FLOW into the lottery pool', 'lottery', lotteryDepositResult, { poolId }));

  const lotteryYieldResult = sendTransaction('AccumulateLotteryYield.cdc', [poolId, '12.50000000']);
  activity.push(buildActivity('Seeded the lottery prize vault', 'lottery', lotteryYieldResult, { poolId }));

  const lotteryDrawResult = sendTransaction('DrawLottery.cdc', [poolId]);
  activity.push(buildActivity('Closed a live lottery round on testnet', 'lottery', lotteryDrawResult, { poolId }));

  const lotteryReloadResult = sendTransaction('AccumulateLotteryYield.cdc', [poolId, '31.25000000']);
  activity.push(buildActivity('Reloaded the next lottery jackpot', 'lottery', lotteryReloadResult, { poolId }));

  const initPortfolioResult = trySendTransaction(
    'InitPortfolio.cdc',
    [portfolioId, 'moderate', '{"FLOW":55.0,"stFLOW":25.0,"USDC":20.0}']
  );
  activity.push(buildActivity('Opened AI-managed treasury portfolio', 'portfolio', initPortfolioResult, { portfolioId }));

  const createSubscriptionResult = sendTransaction(
    'CreateSubscription.cdc',
    [subscriptionId, walletAddress, '32.00000000', '2592000.0', '12', 'Treasury Circle membership', streamId]
  );
  activity.push(buildActivity('Created recurring subscription stream', 'subscription', createSubscriptionResult, { subscriptionId }));

  const mintGiftCardResult = sendTransaction(
    'MintGiftCard.cdc',
    [streamId, walletAddress, 'Milestone reward for the operations squad', '0.0', '45.00000000']
  );
  activity.push(buildActivity('Minted a yield-bearing milestone gift card', 'giftcard', mintGiftCardResult, { streamId }));

  const vaultState = executeScript('GetVaultState.cdc', [walletAddress, streamId]);
  const activeRules = executeScript('GetActiveRules.cdc', [walletAddress, streamId]);
  const lotteryPool = executeScript('GetLotteryPool.cdc', [walletAddress, poolId, walletAddress]);
  const giftCards = executeScript('GetGiftCards.cdc', [walletAddress]);
  const workCredential = executeScript('GetWorkCredential.cdc', [walletAddress, streamId]);
  const portfolio = executeScript('GetPortfolio.cdc', [walletAddress, portfolioId]);

  ensureDir(DEPLOYMENTS_DIR);
  writeJson(path.join(DEPLOYMENTS_DIR, 'cadence-testnet.json'), {
    network: 'testnet',
    accountName: account.name,
    accountAddress: walletAddress,
    contractAddress: walletAddress,
    streamId,
    poolId,
    portfolioId,
    subscriptionId,
    seededAt: new Date().toISOString(),
    activity,
    surfacedFeatures: {
      walletless: true,
      sponsoredTransactions: true,
      naturalLanguageRules: true,
      managedPortfolio: true,
      losslessLottery: true,
      yieldGiftCards: true,
    },
    transactions: {
      createStream: createStreamResult,
      seedState: seedResult,
      rules: ruleResults,
      lottery: {
        init: initLotteryResult,
        deposit: lotteryDepositResult,
        seedYield: lotteryYieldResult,
        draw: lotteryDrawResult,
        reload: lotteryReloadResult,
      },
      portfolio: initPortfolioResult,
      subscription: createSubscriptionResult,
      giftCard: mintGiftCardResult,
    },
    verification: {
      vaultState,
      activeRules,
      lotteryPool,
      giftCards,
      workCredential,
      portfolio,
    },
  });

  upsertEnvFile({
    FLOW_DASHBOARD_STREAM_ID: streamId,
    FLOW_DASHBOARD_LOTTERY_ID: poolId,
    FLOW_DASHBOARD_PORTFOLIO_ID: portfolioId,
    FLOW_CONTRACT_ADDRESS: walletAddress,
    VITE_FLOW_DASHBOARD_ACCOUNT_ADDRESS: walletAddress,
    VITE_FLOW_DASHBOARD_STREAM_ID: streamId,
    VITE_FLOW_DASHBOARD_LOTTERY_ID: poolId,
    VITE_FLOW_DASHBOARD_PORTFOLIO_ID: portfolioId,
    VITE_FLOW_DASHBOARD_SALARY_RATE: salaryRate,
    VITE_FLOW_CONTRACT_ADDRESS: walletAddress,
  });

  return {
    streamId,
    poolId,
    portfolioId,
    vaultState,
    activeRules,
  };
}

function updateAccountEnv(account) {
  upsertEnvFile({
    FLOW_TESTNET_ACCOUNT_NAME: account.name,
    FLOW_TESTNET_ADDRESS: account.address,
    FLOW_TESTNET_KEY: account.key,
    FLOW_CONTRACT_ADDRESS: toFlowHexAddress(account.address),
    VITE_FLOW_CONTRACT_ADDRESS: toFlowHexAddress(account.address),
  });
}

function deployEvm() {
  logStep('Deploying EVM contracts to Flow testnet');
  runCommand('npx', ['hardhat', 'run', 'evm/scripts/deployOracle.ts', '--network', 'flowTestnet'], {
    inheritStdio: true,
  });

  const deploymentsPath = path.join(DEPLOYMENTS_DIR, 'evm-deployments.json');
  const evmDeployments = readJson(deploymentsPath);

  upsertEnvFile({
    EVM_ORACLE_AGGREGATOR_ADDRESS: evmDeployments.contracts.OracleAggregator,
    EVM_WORK_PROOF_VERIFIER_ADDRESS: evmDeployments.contracts.WorkProofVerifier,
  });

  return evmDeployments;
}

const env = loadEffectiveEnv();
const preferredAccountName = env.FLOW_TESTNET_ACCOUNT_NAME || 'flowpilot-testnet';
const account = ensureTestnetAccount(env, preferredAccountName);

writeTestnetFlowConfig(account);
updateAccountEnv(account);

let cadenceDeployment = null;
let seededDashboard = null;
let evmDeployment = null;

if (!seedOnly) {
  cadenceDeployment = deployCadence(account.name);
}

if (!cadenceOnly || seedOnly) {
  seededDashboard = seedCadenceDashboard(account, loadEffectiveEnv());
}

if (!cadenceOnly && !seedOnly) {
  evmDeployment = deployEvm();
}

logStep('FlowPilot testnet bootstrap complete');
console.log(
  JSON.stringify(
    {
      cadenceDeployment,
      accountAddress: toFlowHexAddress(account.address),
      evmDeployment,
      flowConfigPath: TESTNET_FLOW_CONFIG_PATH,
      seededDashboard,
    },
    null,
    2
  )
);
