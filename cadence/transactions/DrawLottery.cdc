// DrawLottery.cdc
// Draws a lottery winner using deterministic block-height-derived bytes.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import LotteryPool from 0x0000000000000000

transaction(poolId: String) {
    prepare(user: auth(Storage) &Account) {
        let storagePath = StoragePath(identifier: "LotteryPool_".concat(poolId))!
        let pool = user.storage.borrow<&LotteryPool.Pool>(from: storagePath)
            ?? panic("Lottery pool not found: ".concat(poolId))

        var vrfBytes: [UInt8] = []
        let blockHeight = getCurrentBlock().height
        var i = 0
        while i < 32 {
            vrfBytes.append(UInt8((blockHeight + UInt64(i)) % 256))
            i = i + 1
        }

        let winner = pool.drawWinner(vrfOutput: vrfBytes)
        let prize <- pool.claimPrize(winner: winner)

        let receiver = user.storage.borrow<&{FungibleToken.Receiver}>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow user's FlowToken receiver")

        receiver.deposit(from: <- prize)
        log("Lottery winner: ".concat(winner.toString()))
    }
}