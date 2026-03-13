// FlowPilotVault.cdc
// Central protocol resource for FlowPilot — per-second payroll streaming with yield splitting.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract FlowPilotVault {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event StreamCreated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        employer: Address,
        worker: Address,
        ratePerSecond: UFix64
    )
    access(all) event BalanceClaimed(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        amount: UFix64
    )
    access(all) event YieldHarvested(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        workerShare: UFix64,
        protocolShare: UFix64
    )

    // -----------------------------------------------------------------------
    // Entitlements
    // -----------------------------------------------------------------------
    access(all) entitlement Disburse
    access(all) entitlement Claim
    access(all) entitlement Execute
    access(all) entitlement Write

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let VaultStoragePath: StoragePath
    access(all) let VaultPublicPath: PublicPath
    access(all) let SettlementStoragePath: StoragePath

    // -----------------------------------------------------------------------
    // Resource interfaces
    // -----------------------------------------------------------------------
    access(all) resource interface Claimable {
        access(Claim) fun claim(amount: UFix64): @FlowToken.Vault
        fun getClaimableTotal(): UFix64
    }

    access(all) resource interface Streamable {
        access(Execute) fun accruePerSecond(rate: UFix64, elapsed: UFix64)
    }

    // -----------------------------------------------------------------------
    // Vault resource
    // -----------------------------------------------------------------------
    access(all) resource Vault: Claimable, Streamable {

        // Sub-ledgers
        access(all) var salaryAccrued: UFix64
        access(all) var yieldPrincipal: UFix64
        access(all) var yieldEarned: UFix64

        // Protocol treasury address
        access(all) var treasuryAddress: Address

        // Split ratio: default 0.8 (80% to user, 20% to protocol treasury)
        access(all) let yieldSplitRatio: UFix64

        // Stream metadata
        access(all) let streamId: String
        access(all) let workerAddress: Address
        access(all) let employerAddress: Address

        // Underlying token vault for holding deposited funds
        access(self) var tokenVault: @FlowToken.Vault

        init(
            streamId: String,
            employer: Address,
            worker: Address,
            yieldSplitRatio: UFix64,
            treasury: Address,
            initialFunding: @FlowToken.Vault
        ) {
            self.streamId = streamId
            self.employerAddress = employer
            self.workerAddress = worker
            self.yieldSplitRatio = yieldSplitRatio
            self.treasuryAddress = treasury
            self.salaryAccrued = 0.0
            self.yieldPrincipal = 0.0
            self.yieldEarned = 0.0
            self.tokenVault <- initialFunding
        }

        // Per-second accrual using 128-bit math (never native UFix64 multiplication for time-based math)
        access(Execute) fun accruePerSecond(rate: UFix64, elapsed: UFix64) {
            let accrued = FlowDeFiMathUtils.mul128(rate, elapsed)
            self.salaryAccrued = self.salaryAccrued + accrued
        }

        // Returns total claimable balance
        access(all) fun getClaimableTotal(): UFix64 {
            return self.salaryAccrued + self.yieldEarned
        }

        // Claim funds — requires Claim entitlement
        access(Claim) fun claim(amount: UFix64): @FlowToken.Vault {
            pre {
                amount <= self.getClaimableTotal(): "Insufficient claimable balance"
                amount <= self.tokenVault.balance: "Insufficient vault balance"
            }
            // Deduct from sub-ledgers in order: salary first, then yield
            var remaining = amount
            if self.salaryAccrued >= remaining {
                self.salaryAccrued = self.salaryAccrued - remaining
                remaining = 0.0
            } else {
                remaining = remaining - self.salaryAccrued
                self.salaryAccrued = 0.0
                if self.yieldEarned >= remaining {
                    self.yieldEarned = self.yieldEarned - remaining
                    remaining = 0.0
                } else {
                    self.yieldEarned = 0.0
                }
            }
            let withdrawn <- self.tokenVault.withdraw(amount: amount)
            emit BalanceClaimed(
                streamId: self.streamId,
                userAddress: self.workerAddress,
                timestamp: getCurrentBlock().timestamp,
                amount: amount
            )
            return <- withdrawn
        }

        // Harvest yield and apply the split ratio using 128-bit math
        access(all) fun harvestYield(rawYield: UFix64): UFix64 {
            pre { rawYield > 0.0: "No yield to harvest" }
            let workerShare = FlowDeFiMathUtils.mul128(rawYield, self.yieldSplitRatio)
            let protocolShare = rawYield - workerShare
            self.yieldEarned = self.yieldEarned + workerShare
            emit YieldHarvested(
                streamId: self.streamId,
                userAddress: self.workerAddress,
                timestamp: getCurrentBlock().timestamp,
                workerShare: workerShare,
                protocolShare: protocolShare
            )
            return protocolShare
        }

        // Deposit funds into the underlying vault (employer funding)
        access(Disburse) fun deposit(from: @FlowToken.Vault) {
            self.yieldPrincipal = self.yieldPrincipal + from.balance
            self.tokenVault.deposit(from: <- from)
        }

        // Deposit yield earnings into the vault
        access(all) fun depositYield(from: @FlowToken.Vault) {
            self.tokenVault.deposit(from: <- from)
        }

        // Return current token vault balance
        access(all) fun getTokenBalance(): UFix64 {
            return self.tokenVault.balance
        }
    }

    // -----------------------------------------------------------------------
    // SettlementAuthority — only entity that can write WorkCredential
    // -----------------------------------------------------------------------
    access(all) resource SettlementAuthority {
        access(all) let vaultRef: Capability<auth(Write) &Vault>

        init(vaultCap: Capability<auth(Write) &Vault>) {
            self.vaultRef = vaultCap
        }

        // Settle salary and update WorkCredential via Write entitlement
        access(all) fun settle(amount: UFix64) {
            // Settlement logic — vault ref available for Write-gated operations
        }
    }

    // -----------------------------------------------------------------------
    // Contract-level factory function
    // -----------------------------------------------------------------------
    access(all) fun createVault(
        streamId: String,
        employer: Address,
        worker: Address,
        yieldSplitRatio: UFix64,
        treasury: Address,
        initialFunding: @FlowToken.Vault
    ): @Vault {
        emit StreamCreated(
            streamId: streamId,
            userAddress: worker,
            timestamp: getCurrentBlock().timestamp,
            employer: employer,
            worker: worker,
            ratePerSecond: 0.0
        )
        return <- create Vault(
            streamId: streamId,
            employer: employer,
            worker: worker,
            yieldSplitRatio: yieldSplitRatio,
            treasury: treasury,
            initialFunding: <- initialFunding
        )
    }

    init() {
        self.VaultStoragePath = /storage/FlowPilotVault
        self.VaultPublicPath = /public/FlowPilotVault
        self.SettlementStoragePath = /storage/FlowPilotSettlement
    }
}
