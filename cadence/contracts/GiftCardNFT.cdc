// GiftCardNFT.cdc
// Yield-bearing gift cards as transferable NFTs with capability-gated vaults.

import NonFungibleToken from 0x631e88ae7f1d7c20
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7
import FlowPilotVault from 0x0000000000000000

access(all) contract GiftCardNFT: NonFungibleToken {

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
    // Entitlements
    // -----------------------------------------------------------------------
    access(all) entitlement Mint

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
    // GiftCard NFT resource
    // -----------------------------------------------------------------------
    access(all) resource NFT: NonFungibleToken.NFT {

        access(all) let id: UInt64
        // Capability to read balance — not to drain
        access(all) var vaultCap: Capability<&FlowPilotVault.Vault>
        access(all) var targetDate: UFix64?
        access(all) var message: String
        access(all) let sender: Address
        access(all) var recipient: Address
        access(all) var principalAmount: UFix64
        access(all) var redeemed: Bool

        init(
            id: UInt64,
            vaultCap: Capability<&FlowPilotVault.Vault>,
            targetDate: UFix64?,
            message: String,
            sender: Address,
            recipient: Address,
            principalAmount: UFix64
        ) {
            self.id = id
            self.vaultCap = vaultCap
            self.targetDate = targetDate
            self.message = message
            self.sender = sender
            self.recipient = recipient
            self.principalAmount = principalAmount
            self.redeemed = false
        }

        // Get accrued yield — readable by anyone holding the NFT
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

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- GiftCardNFT.createEmptyCollection(nftType: Type<@GiftCardNFT.NFT>())
        }
    }

    // -----------------------------------------------------------------------
    // Collection resource
    // -----------------------------------------------------------------------
    access(all) resource Collection: NonFungibleToken.Collection {

        access(all) var ownedNFTs: @{UInt64: {NonFungibleToken.NFT}}

        init() {
            self.ownedNFTs <- {}
        }

        access(NonFungibleToken.Withdraw) fun withdraw(withdrawID: UInt64): @{NonFungibleToken.NFT} {
            let token <- self.ownedNFTs.remove(key: withdrawID)
                ?? panic("GiftCard not found")
            emit Withdraw(id: withdrawID, from: self.owner?.address)
            return <- token
        }

        access(all) fun deposit(token: @{NonFungibleToken.NFT}) {
            let card <- token as! @GiftCardNFT.NFT
            let id = card.id
            let old <- self.ownedNFTs[id] <- card
            destroy old
            emit Deposit(id: id, to: self.owner?.address)
        }

        access(all) fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        access(all) fun borrowNFT(_ id: UInt64): &{NonFungibleToken.NFT}? {
            return &self.ownedNFTs[id]
        }

        access(all) fun borrowGiftCard(_ id: UInt64): &NFT? {
            return self.ownedNFTs[id] as? &NFT
        }

        access(all) fun getSupportedNFTTypes(): {Type: Bool} {
            return {Type<@GiftCardNFT.NFT>(): true}
        }

        access(all) fun isSupportedNFTType(type: Type): Bool {
            return type == Type<@GiftCardNFT.NFT>()
        }

        access(all) fun createEmptyCollection(): @{NonFungibleToken.Collection} {
            return <- GiftCardNFT.createEmptyCollection(nftType: Type<@GiftCardNFT.NFT>())
        }
    }

    // -----------------------------------------------------------------------
    // Minter resource — requires Mint entitlement
    // -----------------------------------------------------------------------
    access(all) resource Minter {

        access(Mint) fun mintGiftCard(
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
                streamId: id.toString(),
                userAddress: sender,
                timestamp: getCurrentBlock().timestamp,
                id: id,
                recipient: recipient,
                amount: principalAmount,
                message: message
            )

            return <- create NFT(
                id: id,
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
    access(all) fun createEmptyCollection(nftType: Type): @{NonFungibleToken.Collection} {
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
