// GetLotteryPool.cdc
// Returns the current state of the lottery pool.

import LotteryPool from 0x0000000000000000

access(all) struct PoolView {
    access(all) let poolId: String
    access(all) let totalPrincipal: UFix64
    access(all) let yieldAccumulated: UFix64
    access(all) let totalTickets: UFix64
    access(all) let poolBalance: UFix64
    access(all) let drawCount: UInt64
    access(all) let participantCount: Int

    init(
        poolId: String,
        totalPrincipal: UFix64,
        yieldAccumulated: UFix64,
        totalTickets: UFix64,
        poolBalance: UFix64,
        drawCount: UInt64,
        participantCount: Int
    ) {
        self.poolId = poolId
        self.totalPrincipal = totalPrincipal
        self.yieldAccumulated = yieldAccumulated
        self.totalTickets = totalTickets
        self.poolBalance = poolBalance
        self.drawCount = drawCount
        self.participantCount = participantCount
    }
}

access(all) fun main(accountAddress: Address, poolId: String): PoolView? {
    let account = getAccount(accountAddress)

    let poolCap = account.capabilities.get<&LotteryPool.Pool>(
        PublicPath(identifier: "LotteryPool_".concat(poolId))!
    )

    if let pool = poolCap.borrow() {
        return PoolView(
            poolId: poolId,
            totalPrincipal: pool.totalPrincipal(),
            yieldAccumulated: pool.yieldAccumulated,
            totalTickets: pool.totalTickets,
            poolBalance: pool.getPoolBalance(),
            drawCount: pool.drawCount,
            participantCount: pool.principalDeposits.length
        )
    }

    return nil
}
