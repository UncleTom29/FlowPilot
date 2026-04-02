import rawDeploymentSnapshot from '../generated/demoDeploymentState.json';

export interface ActivityItem {
  title: string;
  category: string;
  txId?: string | null;
  explorerUrl?: string | null;
  timestamp: string;
  [key: string]: unknown;
}

export interface DeploymentState {
  cadence: {
    accountAddress: string;
    contractAddress: string;
    streamId: string;
    poolId?: string;
    portfolioId?: string;
    subscriptionId?: string;
    seededAt?: string;
    activity?: ActivityItem[];
    surfacedFeatures?: Record<string, boolean>;
    verificationSummary?: Record<string, unknown>;
  } | null;
  evm: {
    seedData?: Record<string, unknown>;
    contracts?: Record<string, string>;
  } | null;
  signer: string;
  ready: boolean;
  relayReady?: boolean;
  accessNode?: string;
  generatedAt?: string;
}

export type DeploymentSource = 'backend' | 'snapshot';

export const DEPLOYMENT_SNAPSHOT_STATE = rawDeploymentSnapshot as DeploymentState;
