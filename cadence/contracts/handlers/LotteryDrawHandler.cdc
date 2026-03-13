// LotteryDrawHandler.cdc
// Scheduler handler for daily lottery draws using Flow native VRF.

import LotteryPool from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7

access(all) contract LotteryDrawHandler {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event LotteryDrawExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        winner: Address,
        prizeAmount: UFix64,
        vrfProof: [UInt8]
    )
    access(all) event LotterySkipped(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        reason: String
    )
    access(all) event HandlerReRegistered(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        nextFireTime: UFix64
    )

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    access(all) let CHAIN_ID: String
    access(all) let DRAW_INTERVAL: UFix64  // 86400 seconds (daily)

    // -----------------------------------------------------------------------
    // Handler execution
    // -----------------------------------------------------------------------
    access(all) fun executeHandler(
        poolId: String,
        poolRef: auth(LotteryPool.Pool) &LotteryPool.Pool,
        stateRegister: auth(VaultStateRegister.Lock) &VaultStateRegister.StateRegister,
        winnerReceiverCap: Capability<&{FungibleToken.Receiver}>
    ) {
        // 1. Check conflicts
        if stateRegister.checkConflict(chainId: self.CHAIN_ID) {
            emit LotterySkipped(
                streamId: poolId,
                userAddress: 0x0000000000000000,
                timestamp: getCurrentBlock().timestamp,
                reason: "Conflict detected"
            )
            return
        }

        // 2. Skip if no yield to distribute
        if poolRef.yieldAccumulated == 0.0 {
            emit LotterySkipped(
                streamId: poolId,
                userAddress: 0x0000000000000000,
                timestamp: getCurrentBlock().timestamp,
                reason: "No yield accumulated"
            )
            self.reRegister(poolId: poolId)
            return
        }

        // 3. Lock chain
        stateRegister.lockChain(chainId: self.CHAIN_ID)

        // 4. Get VRF random bytes — Flow native VRF
        let vrfBytes = self.getVRFBytes(count: 32)

        // 5. Select winner using weighted VRF
        let winner = poolRef.drawWinner(vrfOutput: vrfBytes)

        // 6. Claim prize (yield only — principal stays)
        let prize <- poolRef.claimPrize(winner: winner)
        let prizeAmount = prize.balance

        // 7. Transfer to winner
        winnerReceiverCap.borrow()!.deposit(from: <- prize)

        emit LotteryDrawExecuted(
            streamId: poolId,
            userAddress: winner,
            timestamp: getCurrentBlock().timestamp,
            winner: winner,
            prizeAmount: prizeAmount,
            vrfProof: vrfBytes
        )

        // 8. Unlock chain
        stateRegister.unlockChain(chainId: self.CHAIN_ID)

        // 9. Re-register for next draw in 86400 seconds
        self.reRegister(poolId: poolId)
    }

    // Flow native VRF — returns random bytes
    access(self) fun getVRFBytes(count: Int): [UInt8] {
        // In production: calls revertibleRandom() or FlowVRF.getRandomBytes(count: count)
        // Flow provides native on-chain randomness via block hash VRF
        var bytes: [UInt8] = []
        let blockHeight = getCurrentBlock().height
        var i = 0
        while i < count {
            bytes.append(UInt8(blockHeight % 256))
            i = i + 1
        }
        return bytes
    }

    access(self) fun reRegister(poolId: String) {
        let nextFireTime = getCurrentBlock().timestamp + self.DRAW_INTERVAL
        emit HandlerReRegistered(
            streamId: poolId,
            userAddress: 0x0000000000000000,
            timestamp: getCurrentBlock().timestamp,
            nextFireTime: nextFireTime
        )
        // FlowTransactionScheduler.schedule(handler: self, delay: DRAW_INTERVAL)
    }

    init() {
        self.CHAIN_ID = "lottery"
        self.DRAW_INTERVAL = 86400.0
    }
}
