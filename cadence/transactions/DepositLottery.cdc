// DepositLottery.cdc
// Deposits FLOW principal into a lottery pool from the caller's FlowToken vault.

import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import LotteryPool from 0x0000000000000000

transaction(poolId: String, amount: UFix64) {
    prepare(user: auth(Storage) &Account) {
        let storagePath = StoragePath(identifier: "LotteryPool_".concat(poolId))!
        let pool = user.storage.borrow<&LotteryPool.Pool>(from: storagePath)
            ?? panic("Lottery pool not found: ".concat(poolId))

        let flowVault = user.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow user's FlowToken vault")

        let principal <- flowVault.withdraw(amount: amount) as! @FlowToken.Vault
        pool.deposit(from: <- principal, depositor: user.address)
    }
}