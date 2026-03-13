import * as fcl from '@onflow/fcl';

const FLOW_NETWORK = import.meta.env.VITE_FLOW_NETWORK ?? 'testnet';

fcl.config({
  'flow.network': FLOW_NETWORK,
  'accessNode.api':
    FLOW_NETWORK === 'mainnet'
      ? 'https://rest-mainnet.onflow.org'
      : 'https://rest-testnet.onflow.org',
  'discovery.wallet':
    FLOW_NETWORK === 'mainnet'
      ? 'https://fcl-discovery.onflow.org/authn'
      : 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'FlowPilot',
  'app.detail.icon': 'https://flowpilot.app/icon.png',
  'app.detail.description': 'Autonomous personal finance on Flow blockchain',
  // Walletless onboarding — enables passkey / email login
  'discovery.authn.include': [
    'https://accounts.google.com',
    'https://github.com',
  ],
  // WalletConnect for mobile wallets
  'walletconnect.projectId': import.meta.env.VITE_WC_PROJECT_ID ?? '',
});

export default fcl;
