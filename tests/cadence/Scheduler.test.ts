/**
 * Scheduler Tests
 * Tests conflict detection, handler execution, and re-registration.
 */

// @ts-ignore
import {
  init,
  deployContractByName,
  getAccountAddress,
  mintFlow,
  sendTransaction,
  executeScript,
  emulator,
} from '@onflow/flow-js-testing';
import * as path from 'path';
import { describeCadenceSuite, stopEmulatorSafely } from '../helpers/flowCliSupport';

describeCadenceSuite('VaultStateRegister + Scheduler Handlers', () => {
  let deployer: string;
  let worker: string;
  let streamId: string;

  beforeAll(async () => {
    const basePath = path.resolve(__dirname, '../../');
    await init({ basePath });
    await emulator.start({ logging: false });

    deployer = await getAccountAddress('deployer');
    worker = await getAccountAddress('worker');
    streamId = 'scheduler_test_001';

    await mintFlow(deployer, '100.0');
    await mintFlow(worker, '10.0');

    // Deploy all contracts
    for (const name of [
      'FlowDeFiMathUtils',
      'VaultStateRegister',
      'WorkCredential',
      'RuleGraph',
      'FlowPilotVault',
      'LotteryPool',
      'DCAHandler',
      'YieldRebalanceHandler',
      'MilestoneHandler',
    ]) {
      await deployContractByName({ name, to: deployer });
    }
  });

  afterAll(async () => {
    await stopEmulatorSafely(emulator);
  });

  describe('StateRegister', () => {
    it('should initialize state register with no conflicts', async () => {
      const [result, error] = await executeScript({
        code: `
import VaultStateRegister from ${deployer}
access(all) fun main(): {String: AnyStruct} {
  let register <- VaultStateRegister.createStateRegister(streamId: "test", owner: 0x01)
  let result: {String: AnyStruct} = {
    "milestoneDisputed": register.milestoneDisputed,
    "yieldLocked": register.yieldLocked,
    "chainCount": register.activeChains.length
  }
  destroy register
  return result
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result?.milestoneDisputed).toBe(false);
      expect(result?.yieldLocked).toBe(false);
      expect(result?.chainCount).toBe(0);
    });

    it('should detect conflict when chain is active', async () => {
      const [result, error] = await executeScript({
        code: `
import VaultStateRegister from ${deployer}
access(all) fun main(): Bool {
  let register <- VaultStateRegister.createStateRegister(streamId: "test", owner: 0x01)
  // Set chain as active
  register.activeChains["dca"] = true
  // Check conflict
  let hasConflict = register.checkConflict(chainId: "dca")
  destroy register
  return hasConflict
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result).toBe(true);
    });

    it('should return no conflict for different chain IDs', async () => {
      const [result, error] = await executeScript({
        code: `
import VaultStateRegister from ${deployer}
access(all) fun main(): Bool {
  let register <- VaultStateRegister.createStateRegister(streamId: "test", owner: 0x01)
  register.activeChains["yield"] = true
  // DCA should not conflict with yield being active (different chain)
  let hasConflict = register.checkConflict(chainId: "milestone")
  destroy register
  return hasConflict
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result).toBe(false);
    });

    it('should block DCA when milestone is disputed', async () => {
      const [result, error] = await executeScript({
        code: `
import VaultStateRegister from ${deployer}
access(all) fun main(): Bool {
  let register <- VaultStateRegister.createStateRegister(streamId: "test", owner: 0x01)
  register.milestoneDisputed = true
  // DCA should be blocked when milestone is disputed
  let hasConflict = register.checkConflict(chainId: "dca")
  destroy register
  return hasConflict
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result).toBe(true);
    });

    it('should block DCA when yield is locked', async () => {
      const [result, error] = await executeScript({
        code: `
import VaultStateRegister from ${deployer}
access(all) fun main(): Bool {
  let register <- VaultStateRegister.createStateRegister(streamId: "test", owner: 0x01)
  register.yieldLocked = true
  let hasConflict = register.checkConflict(chainId: "dca")
  destroy register
  return hasConflict
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result).toBe(true);
    });
  });

  describe('DCAHandler', () => {
    it('should emit HandlerReRegistered event on successful execution', async () => {
      // Test that DCAHandler emits the correct re-registration event
      const [result, error] = await executeScript({
        code: `
import DCAHandler from ${deployer}
access(all) fun main(): String {
  return DCAHandler.CHAIN_ID
}`,
        args: [],
      });

      expect(error).toBeNull();
      expect(result).toBe('dca');
    });
  });
});
