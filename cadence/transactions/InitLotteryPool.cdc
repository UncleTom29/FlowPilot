// InitLotteryPool.cdc
// Initializes a lottery pool and publishes a public capability for read-only scripts.

import LotteryPool from 0x0000000000000000

transaction(poolId: String) {
    prepare(user: auth(Storage, Capabilities) &Account) {
        let storagePath = StoragePath(identifier: "LotteryPool_".concat(poolId))!
        assert(
            user.storage.borrow<&LotteryPool.Pool>(from: storagePath) == nil,
            message: "Lottery pool already exists"
        )

        let pool <- LotteryPool.createPool(poolId: poolId)
        user.storage.save(<- pool, to: storagePath)

        let publicPath = PublicPath(identifier: "LotteryPool_".concat(poolId))!
        user.capabilities.publish(
            user.capabilities.storage.issue<&LotteryPool.Pool>(storagePath),
            at: publicPath
        )

        log("Lottery pool initialized: ".concat(poolId))
    }
}