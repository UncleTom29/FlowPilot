/**
 * OracleAggregator + WorkProofVerifier Tests
 * Tests EVM side contracts using Hardhat.
 */

import { ethers } from 'hardhat';
import { expect } from 'chai';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { OracleAggregator, WorkProofVerifier } from '../../typechain-types';

describe('OracleAggregator', () => {
  let oracle: OracleAggregator;
  let owner: HardhatEthersSigner;
  let aiOracle: HardhatEthersSigner;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    aiOracle = signers[1];

    const OracleAggregatorFactory = await ethers.getContractFactory('OracleAggregator');
    oracle = (await OracleAggregatorFactory.deploy()) as unknown as OracleAggregator;
    await oracle.waitForDeployment();
  });

  describe('Deployment', () => {
    it('should set the deployer as owner', async () => {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it('should start with no protocols', async () => {
      await expect(oracle.getBestAPR()).to.be.revertedWith(
        'OracleAggregator: no protocols registered'
      );
    });
  });

  describe('Protocol Management', () => {
    it('should add a protocol', async () => {
      await oracle.addProtocol('FlowYield', 500); // 5.00%
      expect(await oracle.getProtocolCount()).to.equal(1n);

      const protocol = await oracle.protocols(0);
      expect(protocol.name).to.equal('FlowYield');
      expect(protocol.apr).to.equal(500n);
    });

    it('should update APR for existing protocol', async () => {
      await oracle.addProtocol('FlowYield', 500);
      await oracle.updateAPR(0, 650); // Updated to 6.50%

      const protocol = await oracle.protocols(0);
      expect(protocol.apr).to.equal(650n);
    });

    it('should revert if non-owner tries to add protocol', async () => {
      const [, nonOwner] = await ethers.getSigners();
      await expect(
        oracle.connect(nonOwner).addProtocol('Fake', 1000)
      ).to.be.revertedWith('OracleAggregator: caller is not owner');
    });
  });

  describe('getBestAPR', () => {
    it('should return protocol with highest APR', async () => {
      await oracle.addProtocol('LowYield', 200);   // 2.00%
      await oracle.addProtocol('MidYield', 500);   // 5.00%
      await oracle.addProtocol('HighYield', 680);  // 6.80%

      const [name, apr, index] = await oracle.getBestAPR();
      expect(name).to.equal('HighYield');
      expect(apr).to.equal(680n);
      expect(index).to.equal(2n);
    });

    it('should return correct best APR when only one protocol exists', async () => {
      await oracle.addProtocol('OnlyProtocol', 420);
      const [name, apr] = await oracle.getBestAPR();
      expect(name).to.equal('OnlyProtocol');
      expect(apr).to.equal(420n);
    });

    it('should handle APR update and return new best', async () => {
      await oracle.addProtocol('ProtocolA', 300);
      await oracle.addProtocol('ProtocolB', 500);

      // Initially ProtocolB is best
      let [name] = await oracle.getBestAPR();
      expect(name).to.equal('ProtocolB');

      // Update ProtocolA to be higher
      await oracle.updateAPR(0, 700);

      [name] = await oracle.getBestAPR();
      expect(name).to.equal('ProtocolA');
    });
  });

  describe('Portfolio Signals', () => {
    it('should accept portfolio signals from AI oracle', async () => {
      await oracle.setAIOracleAddress(aiOracle.address);

      const portfolioId = ethers.keccak256(ethers.toUtf8Bytes('portfolio_001'));
      const signal = ethers.toUtf8Bytes('{"FLOW": 0.6, "USDC": 0.4}');

      await oracle.connect(aiOracle).submitPortfolioSignal(portfolioId, signal);

      const [storedSignal] = await oracle.getPortfolioSignal(portfolioId);
      expect(ethers.toUtf8String(storedSignal)).to.equal('{"FLOW": 0.6, "USDC": 0.4}');
    });

    it('should reject portfolio signals from non-AI-oracle', async () => {
      const [, nonOracle] = await ethers.getSigners();
      const portfolioId = ethers.keccak256(ethers.toUtf8Bytes('test'));
      await expect(
        oracle.connect(nonOracle).submitPortfolioSignal(portfolioId, '0x1234')
      ).to.be.revertedWith('OracleAggregator: caller is not AI oracle');
    });
  });
});

describe('WorkProofVerifier', () => {
  let verifier: WorkProofVerifier;
  let employer: HardhatEthersSigner;
  let worker: HardhatEthersSigner;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    employer = signers[0];
    worker = signers[1];

    const WorkProofVerifierFactory = await ethers.getContractFactory('WorkProofVerifier');
    verifier = (await WorkProofVerifierFactory.deploy()) as unknown as WorkProofVerifier;
    await verifier.waitForDeployment();
  });

  describe('Proof Submission', () => {
    it('should submit a work proof', async () => {
      const milestoneId = ethers.keccak256(ethers.toUtf8Bytes('milestone_001'));
      const workHash = ethers.keccak256(ethers.toUtf8Bytes('work_deliverable_ipfs_cid'));

      await verifier.submitProof(milestoneId, workHash, worker.address);

      const proof = await verifier.getProof(milestoneId);
      expect(proof.employer).to.equal(employer.address);
      expect(proof.worker).to.equal(worker.address);
      expect(proof.workHash).to.equal(workHash);
      expect(proof.verified).to.be.false;
    });

    it('should revert if proof already exists', async () => {
      const milestoneId = ethers.keccak256(ethers.toUtf8Bytes('milestone_dup'));
      const workHash = ethers.keccak256(ethers.toUtf8Bytes('work'));

      await verifier.submitProof(milestoneId, workHash, worker.address);
      await expect(
        verifier.submitProof(milestoneId, workHash, worker.address)
      ).to.be.revertedWith('WorkProofVerifier: proof already exists');
    });
  });

  describe('Proof Verification', () => {
    it('should verify a valid worker signature', async () => {
      const milestoneId = ethers.keccak256(ethers.toUtf8Bytes('milestone_verify'));
      const workHash = ethers.keccak256(ethers.toUtf8Bytes('deliverable_hash'));

      await verifier.submitProof(milestoneId, workHash, worker.address);

      // Worker signs: keccak256(milestoneId + workHash)
      const messageHash = ethers.keccak256(
        ethers.concat([milestoneId, workHash])
      );
      const signature = await worker.signMessage(ethers.getBytes(messageHash));

      await verifier.verifyProof(milestoneId, signature);

      expect(await verifier.isVerified(milestoneId)).to.be.true;
    });

    it('should revert on invalid signer', async () => {
      const milestoneId = ethers.keccak256(ethers.toUtf8Bytes('milestone_invalid'));
      const workHash = ethers.keccak256(ethers.toUtf8Bytes('deliverable'));

      await verifier.submitProof(milestoneId, workHash, worker.address);

      // Sign with wrong signer (employer instead of worker)
      const messageHash = ethers.keccak256(ethers.concat([milestoneId, workHash]));
      const wrongSignature = await employer.signMessage(ethers.getBytes(messageHash));

      await expect(
        verifier.verifyProof(milestoneId, wrongSignature)
      ).to.be.revertedWith('WorkProofVerifier: invalid signature');
    });

    it('isVerified should return false before verification', async () => {
      const milestoneId = ethers.keccak256(ethers.toUtf8Bytes('not_yet_verified'));
      expect(await verifier.isVerified(milestoneId)).to.be.false;
    });
  });
});
