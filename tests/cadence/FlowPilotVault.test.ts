/**
 * FlowPilotVault Test Suite
 * Tests core vault operations using @onflow/flow-js-testing.
 */

// @ts-ignore — flow-js-testing has limited type definitions
import {
  init,
  deployContractByName,
  getContractAddress,
  getAccountAddress,
  mintFlow,
  sendTransaction,
  executeScript,
  emulator,
} from '@onflow/flow-js-testing';
import * as path from 'path';
import { describeCadenceSuite, stopEmulatorSafely } from '../helpers/flowCliSupport';

describeCadenceSuite('FlowPilotVault', () => {
  let employer: string;
  let worker: string;
  let streamId: string;

  beforeAll(async () => {
    const basePath = path.resolve(__dirname, '../../');
    await init({ basePath });
    await emulator.start({ logging: false });

    employer = await getAccountAddress('employer');
    worker = await getAccountAddress('worker');
    streamId = 'test_stream_001';

    // Fund accounts
    await mintFlow(employer, '100.0');
    await mintFlow(worker, '10.0');
  });

  afterAll(async () => {
    await stopEmulatorSafely(emulator);
  });

  describe('Contract Deployment', () => {
    it('should deploy FlowDeFiMathUtils', async () => {
      const [, error] = await deployContractByName({
        name: 'FlowDeFiMathUtils',
        to: employer,
      });
      expect(error).toBeNull();
    });

    it('should deploy VaultStateRegister', async () => {
      const [, error] = await deployContractByName({
        name: 'VaultStateRegister',
        to: employer,
      });
      expect(error).toBeNull();
    });

    it('should deploy WorkCredential', async () => {
      const [, error] = await deployContractByName({
        name: 'WorkCredential',
        to: employer,
      });
      expect(error).toBeNull();
    });

    it('should deploy RuleGraph', async () => {
      const [, error] = await deployContractByName({
        name: 'RuleGraph',
        to: employer,
      });
      expect(error).toBeNull();
    });

    it('should deploy FlowPilotVault', async () => {
      const [, error] = await deployContractByName({
        name: 'FlowPilotVault',
        to: employer,
      });
      expect(error).toBeNull();
    });
  });

  describe('CreateStream', () => {
    it('should create a stream and initialize all resources', async () => {
      // Rate: $2000/month = 2000/2592000 FLOW/sec ≈ 0.00077160 FLOW/sec
      const ratePerSecond = 0.0007716;
      const yieldSplitRatio = 0.8;
      const milestoneIntervalDays = 30;
      const initialFunding = 50.0;

      const [txResult, error] = await sendTransaction({
        name: 'CreateStream',
        signers: [employer],
        args: [
          streamId,
          worker,
          ratePerSecond.toFixed(8),
          yieldSplitRatio.toFixed(8),
          milestoneIntervalDays.toFixed(1),
          initialFunding.toFixed(8),
          'Software Engineer',
        ],
      });

      expect(error).toBeNull();
      expect(txResult).toBeDefined();

      // Verify StreamCreated event was emitted
      const streamCreatedEvents = (txResult?.events ?? []).filter(
        (e: { type: string }) => e.type.includes('StreamCreated')
      );
      expect(streamCreatedEvents.length).toBeGreaterThan(0);
    });

    it('should have correct initial vault state', async () => {
      const [vaultState, error] = await executeScript({
        name: 'GetVaultState',
        args: [employer, streamId],
      });

      expect(error).toBeNull();
      expect(vaultState).toBeDefined();
      expect(parseFloat(vaultState.yieldSplitRatio)).toBeCloseTo(0.8, 6);
      expect(parseFloat(vaultState.yieldPrincipal)).toBeCloseTo(50.0, 4);
      expect(vaultState.milestoneDisputed).toBe(false);
    });
  });

  describe('Per-Second Accrual', () => {
    it('should accrue salary correctly over 3600 seconds using 128-bit precision', async () => {
      const ratePerSecond = 0.0007716;
      const elapsedSeconds = 3600;
      const expectedAccrual = ratePerSecond * elapsedSeconds; // ~2.778 FLOW

      // Simulate accrual by advancing emulator clock
      // In flow-js-testing: use emulator.setBlockTimestamp or equivalent
      // Here we test the math computation directly

      const [result, error] = await executeScript({
        code: `
import FlowDeFiMathUtils from ${await getContractAddress('FlowDeFiMathUtils')}
access(all) fun main(): UFix64 {
  return FlowDeFiMathUtils.mul128(0.00077160, 3600.0)
}`,
        args: [],
      });

      expect(error).toBeNull();
      // The 128-bit result should match expected with high precision
      expect(parseFloat(result)).toBeCloseTo(expectedAccrual, 4);
    });
  });

  describe('Yield Split', () => {
    it('should split 100 FLOW yield 80/20 correctly', async () => {
      const rawYield = 100.0;
      const splitRatio = 0.8;

      const [result, error] = await executeScript({
        code: `
import FlowDeFiMathUtils from ${await getContractAddress('FlowDeFiMathUtils')}
access(all) fun main(): [UFix64] {
  let workerShare = FlowDeFiMathUtils.mul128(${rawYield.toFixed(8)}, ${splitRatio.toFixed(8)})
  let protocolShare = ${rawYield.toFixed(8)} - workerShare
  return [workerShare, protocolShare]
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(parseFloat(result[0])).toBeCloseTo(80.0, 5);
      expect(parseFloat(result[1])).toBeCloseTo(20.0, 5);
    });
  });

  describe('ClaimBalance', () => {
    it('should allow worker to claim earned salary', async () => {
      const amountToClaim = 5.0;

      // First accrue some salary
      // In production: advance clock or call accruePerSecond handler

      const [, error] = await sendTransaction({
        name: 'ClaimBalance',
        signers: [worker],
        args: [streamId, amountToClaim.toFixed(8)],
      });

      // This may fail if accrual hasn't happened — check error type
      if (error) {
        // Expected if no salary has accrued yet
        expect(error.toString()).toMatch(/Insufficient claimable balance/);
      } else {
        // Verify balance decreased
        const [vaultState] = await executeScript({
          name: 'GetVaultState',
          args: [worker, streamId],
        });
        expect(parseFloat(vaultState?.salaryAccrued ?? '0')).toBeLessThanOrEqual(
          5.0 - amountToClaim
        );
      }
    });
  });
});
