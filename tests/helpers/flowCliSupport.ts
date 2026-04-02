import { execFileSync } from 'node:child_process';

type EmulatorLike = {
  stop: () => Promise<unknown>;
};

const SUPPORTED_PREVIEW_TAG = 'cadence-v1.0.0-preview';
const CADENCE_TESTS_ENABLED = process.env.FLOWPILOT_RUN_CADENCE_TESTS === '1';

function parseFlowVersion(rawOutput: string): string | null {
  const versionLine = rawOutput
    .split(/\r?\n/)
    .find((line) => line.toLowerCase().startsWith('version:'));

  if (!versionLine) {
    return null;
  }

  return versionLine.split(':').slice(1).join(':').trim() || null;
}

function supportsFlowJsTesting(version: string | null): boolean {
  if (!version) {
    return false;
  }

  if (version.includes(SUPPORTED_PREVIEW_TAG)) {
    return true;
  }

  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) {
    return false;
  }

  return Number(match[1]) >= 2;
}

function detectFlowCliVersion() {
  try {
    const output = execFileSync(process.env.FLOW_BIN || 'flow', ['version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseFlowVersion(output);
  } catch {
    return null;
  }
}

const detectedFlowVersion = detectFlowCliVersion();
const FLOW_CLI_SUPPORTS_JS_TESTING = supportsFlowJsTesting(detectedFlowVersion);

export const FLOW_JS_TESTING_SUPPORTED = CADENCE_TESTS_ENABLED && FLOW_CLI_SUPPORTS_JS_TESTING;
export const FLOW_JS_TESTING_SKIP_REASON = !CADENCE_TESTS_ENABLED
  ? 'Cadence emulator suites are opt-in. Run FLOWPILOT_RUN_CADENCE_TESTS=1 npm run test:cadence (or npm run test:all) in an emulator-capable environment to execute them.'
  : detectedFlowVersion
    ? `Flow CLI ${detectedFlowVersion} is incompatible with @onflow/flow-js-testing in this repo. Install Flow CLI >=2.0.0 or a ${SUPPORTED_PREVIEW_TAG} build to run Cadence emulator suites.`
    : 'Flow CLI was not found. Install Flow CLI >=2.0.0 to run Cadence emulator suites.';

if (!FLOW_JS_TESTING_SUPPORTED && !(globalThis as { __flowPilotCliSkipLogged?: boolean }).__flowPilotCliSkipLogged) {
  // Keep the warning visible when the suite is intentionally skipped so local runs
  // communicate the real prerequisite instead of failing with emulator internals.
  console.warn(`[tests] ${FLOW_JS_TESTING_SKIP_REASON}`);
  (globalThis as { __flowPilotCliSkipLogged?: boolean }).__flowPilotCliSkipLogged = true;
}

export function describeCadenceSuite(name: string, suite: () => void) {
  const runner = FLOW_JS_TESTING_SUPPORTED ? describe : describe.skip;
  return runner(name, suite);
}

export async function stopEmulatorSafely(emulator: EmulatorLike) {
  if (!FLOW_JS_TESTING_SUPPORTED) {
    return;
  }

  try {
    await emulator.stop();
  } catch {
    // Ignore teardown noise when the emulator never started cleanly.
  }
}
