// GiftCardNFT.cdc
// Yield-bearing gift cards stored in a lightweight custom collection.

import FlowPilotVault from 0x0000000000000000

access(all) contract GiftCardNFT {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    access(all) event ContractInitialized()
    access(all) event GiftCardMinted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        id: UInt64,
        recipient: Address,
        amount: UFix64,
        message: String
    )
    access(all) event GiftCardRedeemed(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        id: UInt64,
        redeemer: Address,
        totalValue: UFix64
    )
    access(all) event Withdraw(id: UInt64, from: Address?)
    access(all) event Deposit(id: UInt64, to: Address?)

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    access(all) var totalSupply: UInt64

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let CollectionStoragePath: StoragePath
    access(all) let CollectionPublicPath: PublicPath
    access(all) let MinterStoragePath: StoragePath

    // -----------------------------------------------------------------------
    // Gift card resource
    // -----------------------------------------------------------------------
    access(all) resource NFT {

        access(all) let id: UInt64
        access(all) let streamId: String
        access(all) var vaultCap: Capability<&FlowPilotVault.Vault>
        access(all) var targetDate: UFix64?
        access(all) var message: String
        access(all) let sender: Address
        access(all) var recipient: Address
        access(all) var principalAmount: UFix64
        access(all) var redeemed: Bool

        init(
            id: UInt64,
            streamId: String,
            vaultCap: Capability<&FlowPilotVault.Vault>,
            targetDate: UFix64?,
            message: String,
            sender: Address,
            recipient: Address,
            principalAmount: UFix64
        ) {
            self.id = id
            self.streamId = streamId
            self.vaultCap = vaultCap
            self.targetDate = targetDate
            self.message = message
            self.sender = sender
            self.recipient = recipient
            self.principalAmount = principalAmount
            self.redeemed = false
        }

        access(all) fun getAccruedYield(): UFix64 {
            if let vault = self.vaultCap.borrow() {
                return vault.yieldEarned
            }
            return 0.0
        }

        // Get total value: principal + yield
        access(all) fun getTotalValue(): UFix64 {
            return self.principalAmount + self.getAccruedYield()
        }

        access(all) fun markRedeemed(totalValue: UFix64, redeemer: Address) {
            assert(!self.redeemed, message: "Gift card already redeemed")
            self.redeemed = true

            emit GiftCardRedeemed(
                streamId: self.streamId,
                userAddress: self.sender,
                timestamp: getCurrentBlock().timestamp,
                id: self.id,
                redeemer: redeemer,
                totalValue: totalValue
            )
        }
    }

    // -----------------------------------------------------------------------
    // Collection resource
    // -----------------------------------------------------------------------
    access(all) resource Collection {

        access(all) var ownedNFTs: @{UInt64: NFT}

        init() {
            self.ownedNFTs <- {}
        }

        access(all) fun withdraw(withdrawID: UInt64): @NFT {
            let token <- self.ownedNFTs.remove(key: withdrawID)
                ?? panic("GiftCard not found")
            emit Withdraw(id: withdrawID, from: self.owner?.address)
            return <- token
        }

        access(all) fun deposit(token: @NFT) {
            let id = token.id
            let old <- self.ownedNFTs[id] <- token
            destroy old
            emit Deposit(id: id, to: self.owner?.address)
        }

        access(all) fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) fun borrowGiftCard(_ id: UInt64): &NFT? {
            if self.ownedNFTs[id] == nil {
                return nil
            }
            let card = &self.ownedNFTs[id] as &NFT?
            return card
        }
    }

    // -----------------------------------------------------------------------
    // Minter resource — requires Mint entitlement
    // -----------------------------------------------------------------------
    access(all) resource Minter {

        access(all) fun mintGiftCard(
            streamId: String,
            vaultCap: Capability<&FlowPilotVault.Vault>,
            targetDate: UFix64?,
            message: String,
            sender: Address,
            recipient: Address,
            principalAmount: UFix64
        ): @NFT {
            let id = GiftCardNFT.totalSupply
            GiftCardNFT.totalSupply = GiftCardNFT.totalSupply + 1

            emit GiftCardMinted(
                streamId: streamId,
                userAddress: sender,
                timestamp: getCurrentBlock().timestamp,
                id: id,
                recipient: recipient,
                amount: principalAmount,
                message: message
            )

            return <- create NFT(
                id: id,
                streamId: streamId,
                vaultCap: vaultCap,
                targetDate: targetDate,
                message: message,
                sender: sender,
                recipient: recipient,
                principalAmount: principalAmount
            )
        }
    }

    // -----------------------------------------------------------------------
    // Collection factory
    // -----------------------------------------------------------------------
    access(all) fun createEmptyCollection(): @Collection {
        return <- create Collection()
    }

    init() {
        self.totalSupply = 0
        self.CollectionStoragePath = /storage/GiftCardNFTCollection
        self.CollectionPublicPath = /public/GiftCardNFTCollection
        self.MinterStoragePath = /storage/GiftCardNFTMinter

        // Store minter in deployer's account
        self.account.storage.save(<- create Minter(), to: self.MinterStoragePath)

        emit ContractInitialized()
    }
}
