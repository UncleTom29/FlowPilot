import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "FLOW");

  // Deploy OracleAggregator
  console.log("\nDeploying OracleAggregator...");
  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
  const oracle = await OracleAggregator.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("OracleAggregator deployed to:", oracleAddress);

  // Deploy WorkProofVerifier
  console.log("\nDeploying WorkProofVerifier...");
  const WorkProofVerifier = await ethers.getContractFactory("WorkProofVerifier");
  const verifier = await WorkProofVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("WorkProofVerifier deployed to:", verifierAddress);

  // Add initial test protocols to OracleAggregator
  console.log("\nConfiguring OracleAggregator...");

  const addTx1 = await oracle.addProtocol("FlowYield", 500); // 5.00% APR
  await addTx1.wait();
  console.log("Added protocol: FlowYield (5.00% APR)");

  const addTx2 = await oracle.addProtocol("FlowStake", 420); // 4.20% APR
  await addTx2.wait();
  console.log("Added protocol: FlowStake (4.20% APR)");

  const addTx3 = await oracle.addProtocol("FlowLend", 680); // 6.80% APR
  await addTx3.wait();
  console.log("Added protocol: FlowLend (6.80% APR)");

  // Verify getBestAPR returns FlowLend
  const [bestName, bestAPR, bestIndex] = await oracle.getBestAPR();
  console.log(
    `\nBest APR: ${bestName} @ ${Number(bestAPR) / 100}% (index: ${bestIndex})`
  );

  const aiOracleAddress =
    process.env.AI_ORACLE_PUBLIC_KEY && ethers.isAddress(process.env.AI_ORACLE_PUBLIC_KEY)
      ? process.env.AI_ORACLE_PUBLIC_KEY
      : deployer.address;

  const setTx = await oracle.setAIOracleAddress(aiOracleAddress);
  await setTx.wait();
  console.log("AI oracle address set:", aiOracleAddress);

  const seededPortfolioId = ethers.id("flowpilot-demo-portfolio");
  const seededSignal = ethers.toUtf8Bytes(
    JSON.stringify({
      risk: "moderate",
      allocations: { FLOW: 60, USDC: 40 },
      rebalanceAt: Math.floor(Date.now() / 1000),
    })
  );

  if (aiOracleAddress.toLowerCase() === deployer.address.toLowerCase()) {
    const signalTx = await oracle.submitPortfolioSignal(seededPortfolioId, seededSignal);
    await signalTx.wait();
    console.log("Seeded portfolio signal for flowpilot-demo-portfolio");
  } else {
    console.log("Skipped demo portfolio signal because AI_ORACLE_PUBLIC_KEY is not the deployer");
  }

  const workerWallet = ethers.Wallet.createRandom();
  const milestoneId = ethers.id("flowpilot-demo-milestone-001");
  const workHash = ethers.id("flowpilot-demo-work-hash");

  const submitProofTx = await verifier.submitProof(
    milestoneId,
    workHash,
    workerWallet.address
  );
  await submitProofTx.wait();
  console.log("Submitted demo work proof for worker:", workerWallet.address);

  const signedPayload = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32"],
    [milestoneId, workHash]
  );
  const signature = await workerWallet.signMessage(ethers.getBytes(signedPayload));

  const verifyProofTx = await verifier.verifyProof(milestoneId, signature);
  await verifyProofTx.wait();
  console.log("Verified demo work proof");

  // Save deployment addresses
  const deployments = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    seedData: {
      aiOracleAddress,
      portfolioId: seededPortfolioId,
      workProof: {
        milestoneId,
        workHash,
        worker: workerWallet.address,
        verified: await verifier.isVerified(milestoneId),
      },
    },
    contracts: {
      OracleAggregator: oracleAddress,
      WorkProofVerifier: verifierAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentsFile = path.join(deploymentsDir, "evm-deployments.json");
  fs.writeFileSync(deploymentsFile, JSON.stringify(deployments, null, 2));
  console.log("\nDeployment addresses saved to:", deploymentsFile);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("OracleAggregator:", oracleAddress);
  console.log("WorkProofVerifier:", verifierAddress);
  console.log("\nAdd these to your .env file:");
  console.log(`EVM_ORACLE_AGGREGATOR_ADDRESS=${oracleAddress}`);
  console.log(`EVM_WORK_PROOF_VERIFIER_ADDRESS=${verifierAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
