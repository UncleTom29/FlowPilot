// LotteryPool.cdc
// Lossless lottery where only accumulated yield is used as prizes.
// Principal deposits are always kept safe and withdrawable.

import FlowToken from 0x7e60df042a9c0868
import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract LotteryPool {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event LotteryDeposit(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        amount: UFix64,
        totalPool: UFix64
    )
    access(all) event LotteryWinner(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        winner: Address,
        prizeAmount: UFix64,
        vrfProof: [UInt8]
    )
    access(all) event LotteryWithdrawal(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        amount: UFix64
    )
    access(all) event YieldAccumulated(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        amount: UFix64
    )

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // Pool resource
    // -----------------------------------------------------------------------
    access(all) resource Pool {

        access(all) let poolId: String
        // Principal deposits per address — never touched by prize distribution
        access(all) var principalDeposits: {Address: UFix64}
        // Accumulated yield available as prize pot
        access(all) var yieldAccumulated: UFix64
        // Ticket weights proportional to deposit size
        access(all) var ticketWeights: {Address: UFix64}
        // Total tickets issued
        access(all) var totalTickets: UFix64
        // Underlying token vault holding all principal + yield
        access(self) var tokenVault: @FlowToken.Vault
        // Draw history
        access(all) var drawCount: UInt64

        init(poolId: String) {
            self.poolId = poolId
            self.principalDeposits = {}
            self.yieldAccumulated = 0.0
            self.ticketWeights = {}
            self.totalTickets = 0.0
            self.tokenVault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>()) as! @FlowToken.Vault
            self.drawCount = 0
        }

        // Deposit principal and mint weighted tickets
        access(all) fun deposit(from: @FlowToken.Vault, depositor: Address) {
            let amount = from.balance
            assert(amount > 0.0, message: "Deposit must be positive")

            // Update principal tracking
            let existing = self.principalDeposits[depositor] ?? 0.0
            self.principalDeposits[depositor] = existing + amount

            // Mint tickets proportional to deposit
            let existingTickets = self.ticketWeights[depositor] ?? 0.0
            self.ticketWeights[depositor] = existingTickets + amount
            self.totalTickets = self.totalTickets + amount

            let total = self.tokenVault.balance + amount
            self.tokenVault.deposit(from: <- from)

            emit LotteryDeposit(
                streamId: self.poolId,
                userAddress: depositor,
                timestamp: getCurrentBlock().timestamp,
                amount: amount,
                totalPool: total
            )
        }

        // Accumulate yield into the prize pot
        access(all) fun accumulateYield(from: @FlowToken.Vault) {
            let amount = from.balance
            self.yieldAccumulated = self.yieldAccumulated + amount
            self.tokenVault.deposit(from: <- from)
            emit YieldAccumulated(
                streamId: self.poolId,
                userAddress: 0x0000000000000000,
                timestamp: getCurrentBlock().timestamp,
                amount: amount
            )
        }

        // Draw winner using VRF bytes — weighted by deposit size
        // Post-condition: principal deposits are unchanged
        access(all) fun drawWinner(vrfOutput: [UInt8]): Address {
            assert(self.yieldAccumulated > 0.0, message: "No yield to distribute")
            assert(self.totalTickets > 0.0, message: "No participants")
            assert(vrfOutput.length >= 16, message: "Insufficient VRF entropy")

            // Select winner using weighted VRF selection
            let targetTicket = FlowDeFiMathUtils.mod128(vrfOutput, self.totalTickets)
            var accumulated = 0.0
            var winner: Address = self.principalDeposits.keys[0]

            for addr in self.principalDeposits.keys {
                let weight = self.ticketWeights[addr] ?? 0.0
                accumulated = accumulated + weight
                if accumulated >= targetTicket {
                    winner = addr
                    break
                }
            }

            self.drawCount = self.drawCount + 1
            return winner
        }

        // Transfer yield prize to winner — principal stays intact
        access(all) fun claimPrize(winner: Address): @FlowToken.Vault {
            assert(self.yieldAccumulated > 0.0, message: "No prize to claim")

            let prizeAmount = self.yieldAccumulated
            self.yieldAccumulated = 0.0

            let prize <- self.tokenVault.withdraw(amount: prizeAmount) as! @FlowToken.Vault

            emit LotteryWinner(
                streamId: self.poolId,
                userAddress: winner,
                timestamp: getCurrentBlock().timestamp,
                winner: winner,
                prizeAmount: prizeAmount,
                vrfProof: []
            )

            return <- prize
        }

        // Withdraw full principal — tickets burned proportionally
        access(all) fun withdraw(depositor: Address): @FlowToken.Vault {
            let principal = self.principalDeposits[depositor] ?? panic("No deposit found")
            assert(principal > 0.0, message: "No principal to withdraw")

            self.principalDeposits[depositor] = 0.0
            let tickets = self.ticketWeights[depositor] ?? 0.0
            self.ticketWeights[depositor] = 0.0
            self.totalTickets = self.totalTickets - tickets

            let withdrawn <- self.tokenVault.withdraw(amount: principal) as! @FlowToken.Vault

            emit LotteryWithdrawal(
                streamId: self.poolId,
                userAddress: depositor,
                timestamp: getCurrentBlock().timestamp,
                amount: principal
            )

            return <- withdrawn
        }

        // Helper: compute total principal across all depositors
        access(all) fun totalPrincipal(): UFix64 {
            var total = 0.0
            for addr in self.principalDeposits.keys {
                total = total + (self.principalDeposits[addr] ?? 0.0)
            }
            return total
        }

        access(all) fun getPoolBalance(): UFix64 {
            return self.tokenVault.balance
        }
    }

    // -----------------------------------------------------------------------
    // Factory
    // -----------------------------------------------------------------------
    access(all) fun createPool(poolId: String): @Pool {
        return <- create Pool(poolId: poolId)
    }

    init() {
        self.StoragePath = /storage/LotteryPool
        self.PublicPath = /public/LotteryPool
    }
}
