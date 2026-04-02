# FlowPilot

FlowPilot is an autonomous consumer-finance operating system built for Flow.

It turns DeFi and treasury coordination into a user-facing product that feels like modern fintech: natural-language automations, sponsored transactions, wallet-light onboarding, invisible safety rails, and on-chain proof of every important state transition.

This submission is aligned to the PL Genesis: Frontiers of Collaboration Hackathon 2026 `Flow`, `AI & Robotics`, and `Crypto` tracks.

## Live Links

- Public frontend: https://flow-pilot-os.vercel.app
- Flow testnet Cadence account: `0x64e0bc9e9ae74ab9`
- Flow testnet Cadence explorer: https://testnet.flowscan.io/account/64e0bc9e9ae74ab9
- Flow EVM `OracleAggregator`: `0x1A94475e85B4d32F85C4c5cfDC5663d6755BbcD9`
- Flow EVM `WorkProofVerifier`: `0xbd0dA4201dF1bc8D9E482Fb93B51DFA1b9CDC05a`

## Why FlowPilot Is Competitive

### Technical Execution

- Flow Cadence contracts power payroll streams, yield routing, subscriptions, portfolio state, lossless lottery logic, gift cards, rule graphs, and work credentials.
- A relay backend compiles natural-language rules into structured actions and submits sponsored Flow testnet transactions.
- Flow EVM sidecars add oracle aggregation and work-proof verification for AI accountability and cross-environment proof surfaces.
- The frontend now ships with a bundled proof pack, runtime fallbacks, and a guarded read-only mode so the public app does not white-screen when the relay is offline.

### Impact / Usefulness

- FlowPilot makes programmable finance accessible to non-crypto-native users.
- It reduces manual DeFi behavior into policies such as “buy $50 of FLOW every week” or “save 20% of each paycheck”.
- It can be used for payroll, subscriptions, savings, capital allocation, reward gifting, treasury management, and worker reputation.

### Completeness / Functionality

- The frontend is deployed publicly on Vercel.
- Flow Cadence contracts are deployed on Flow testnet.
- Flow EVM proof/oracle contracts were redeployed during this submission pass.
- The app includes a safe demo fallback so judges can always inspect live state and shipped proof artifacts even if the relay backend is not publicly exposed.

### Scalability / Future Potential

- The contract system is modular and feature-specific instead of monolithic.
- The frontend can run as a public proof console while the relay backend scales independently.
- The natural-language rule layer can expand from regex-first compilation to policy engines, human approvals, agent-to-agent negotiation, and enterprise workflows.
- The work credential and proof-verifier path can evolve into underwriting, payroll reputation, compliance attestation, or machine-payment rails.

## Track Alignment

### Flow Track

FlowPilot is a direct fit for consumer DeFi on Flow:

- wallet-light onboarding model
- sponsored gas through the managed relay path
- financial actions expressed in human language
- automation via rules, schedules, and autopilots
- invisible security via disputes, locks, and managed execution

Feature-level fit:

- autonomous payroll stream
- scheduled DCA and savings rules
- lossless daily lottery
- recurring subscription payments
- AI-managed treasury portfolio
- yield-backed gift cards
- on-chain work and earnings credential

### AI & Robotics Track

FlowPilot advances safe, accountable, collaborative automation:

- natural-language intent is compiled into explicit, inspectable rule objects
- work proofs are verified on Flow EVM through `WorkProofVerifier`
- portfolio automation is backed by explicit oracle state and rebalance metadata
- human oversight exists through dispute flags, yield locks, and managed relay control
- the UI now surfaces fallback status so users know whether they are in live relay mode or safe public demo mode

This is not “AI for the sake of AI”. It is controlled automation with verifiable execution boundaries.

### Crypto Track

FlowPilot is a crypto coordination system disguised as a consumer app:

- programmable treasury routing
- recurring payment rails
- savings automation
- portfolio policy management
- lossless incentive mechanisms
- yield-bearing digital gift instruments
- work-linked on-chain identity and earnings history

It explores crypto as infrastructure for coordination, not just speculation.

## What Users Can Do

- view a live Flow treasury dashboard
- inspect salary accrual, yield, savings reserve, and claimable balances
- create or preview natural-language rules
- inspect active DCA, portfolio, and subscription automations
- monitor a lossless lottery pool
- mint and redeem yield-bearing gift cards
- inspect a non-transferable work credential
- inspect Flow EVM oracle and proof-verification context

## What Changed In This Submission Pass

- Reworked the frontend so it can operate in `live relay mode` or `public demo mode` without crashing.
- Added bundled deployment-state generation from testnet artifacts via `scripts/testnet/exportFrontendDemoState.mjs`.
- Added a runtime error boundary so the UI fails gracefully instead of blanking out.
- Added track-alignment and proof-pack sections directly inside the product UI for judges.
- Added frontend deployment hardening for Vercel.
- Added backend CORS support for hosted frontends and Vercel preview domains.
- Added deterministic test commands:
  - `npm test` for reliable default smoke coverage
  - `npm run test:cadence` for opt-in Cadence emulator integration tests
  - `npm run test:all` for full opt-in coverage
- Redeployed Flow EVM sidecars and refreshed bundled demo metadata.

## Live Deployment Status

### Public frontend

- Production URL: https://flow-pilot-os.vercel.app
- The public deployment is intentionally resilient:
  - if the relay backend is reachable, judges get sponsored write actions
  - if the relay backend is not reachable, the app falls back to live read queries plus a bundled proof pack

### Flow Cadence

- Contracts are deployed to Flow testnet at `0x64e0bc9e9ae74ab9`.
- The bundled dashboard seed artifact currently reflects the latest fully successful seed snapshot from April 1, 2026.
- During the April 2, 2026 refresh pass, a fresh Cadence deploy succeeded, but a follow-up seed retry hit a transient Flow RPC reset during seeding. The public app therefore keeps the last successful seed snapshot bundled while continuing to query live testnet state directly.

### Flow EVM

- `OracleAggregator`: `0x1A94475e85B4d32F85C4c5cfDC5663d6755BbcD9`
- `WorkProofVerifier`: `0xbd0dA4201dF1bc8D9E482Fb93B51DFA1b9CDC05a`
- Demo work proof was seeded and verified during deployment.

## Architecture

```text
frontend/   React + Vite public dashboard
backend/    Express relay for sponsored Flow actions and rule compilation
cadence/    Flow smart contracts, scripts, and transactions
evm/        Flow EVM oracle and proof-verifier sidecars
scripts/    Testnet bootstrap + artifact sync
tests/      EVM tests plus opt-in Cadence / E2E emulator suites
```

System flow:

1. Cadence contracts publish public capabilities on Flow testnet.
2. The frontend queries live on-chain state through FCL.
3. The backend relays sponsored write actions when exposed.
4. Deployment artifacts are exported into a bundled demo-state file for resilient public demos.
5. Flow EVM contracts store oracle and proof-verification context alongside the Flow-native state model.

## Core Modules

### Cadence contracts

- `FlowPilotVault`
- `VaultStateRegister`
- `RuleGraph`
- `LotteryPool`
- `GiftCardNFT`
- `PortfolioVault`
- `SubscriptionStream`
- `WorkCredential`

### Flow EVM contracts

- `OracleAggregator`
- `WorkProofVerifier`

### Frontend

- Vite + React dashboard
- direct Flow testnet reads with FCL
- public demo fallback artifact
- runtime mode banner
- track-alignment and proof-pack UI blocks

### Backend

- relay endpoints for claims, subscriptions, lottery actions, and gift cards
- natural-language rule preview and deployment
- environment-aware CORS for hosted frontend origins

## Local Development

### Prerequisites

- Node.js 22+
- npm 10+
- Flow CLI installed
- Flow testnet credentials in `.env` or `flow-tester.private.json`
- optional OpenAI / OpenRouter credentials for richer rule parsing fallback

### Install

```bash
npm install
```

### Run locally

```bash
npm run deploy:testnet:all
npm run dev
```

If contracts are already deployed and you only want to refresh the dashboard seed:

```bash
npm run seed:testnet
npm run dev
```

### Frontend-only public build

```bash
npm run build --workspace=frontend
```

The frontend can still render the live dashboard in fallback mode using the checked-in generated deployment artifact.

## Testing

### Default

```bash
npm test
```

This is the stable default smoke path. It runs the EVM suite and skips Cadence emulator suites unless they are explicitly enabled.

### Cadence integration tests

```bash
npm run test:cadence
```

This enables the Flow emulator suites and requires:

- Flow CLI compatible with `@onflow/flow-js-testing`
- an environment that permits opening emulator ports

### Full suite

```bash
npm run test:all
```

## Important Scripts

```bash
npm run dev
npm run deploy:testnet
npm run deploy:testnet:all
npm run seed:testnet
npm run deploy:evm
npm run sync:demo-state
npm test
npm run test:cadence
npm run test:all
```

## Environment

Key variables are documented in `.env.example`.

Important ones:

- `FLOW_TESTNET_ACCOUNT_NAME`
- `FLOW_TESTNET_ADDRESS`
- `FLOW_TESTNET_KEY`
- `FLOW_CONTRACT_ADDRESS`
- `EVM_RPC_URL`
- `EVM_DEPLOYER_PRIVATE_KEY`
- `EVM_ORACLE_AGGREGATOR_ADDRESS`
- `EVM_WORK_PROOF_VERIFIER_ADDRESS`
- `BACKEND_PORT`
- `CORS_ALLOWED_ORIGINS`
- `VITE_BACKEND_URL`
- `VITE_FLOW_NETWORK`
- `VITE_FLOW_CONTRACT_ADDRESS`

## Demo Guidance For Judges

1. Open https://flow-pilot-os.vercel.app
2. Start on `Dashboard` and inspect the Track Alignment and Submission Proof Pack sections.
3. Review `Rules`, `Lottery`, `Portfolio`, and `Credential`.
4. If the relay backend is connected, test sponsored write actions.
5. If the relay backend is not connected, inspect the safe public demo mode and live on-chain reads.

## Roadmap After The Hackathon

- hosted relay backend for full public sponsored-write demos
- passkey or email-first end-user auth
- richer policy compiler with approval workflows
- agent-to-agent payment and negotiation rails
- programmable DAO / treasury coordination features
- richer proof provenance across Flow and Flow EVM

## Honesty Notes

- The public frontend is production-deployed and resilient.
- The Flow EVM sidecars were refreshed successfully in this submission pass.
- The latest Cadence seeding retry hit a transient Flow testnet RPC reset, so the app ships with the most recent fully successful bundled proof snapshot plus live chain reads.
- This tradeoff was intentional: no broken frontend, no blank states, and no fake “everything is live” claims.
