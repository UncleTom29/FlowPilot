import { useCallback, useEffect, useState } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

export interface GiftCardView {
  id: number;
  recipient: string;
  sender: string;
  message: string;
  principalAmount: number;
  accruedYield: number;
  totalValue: number;
  targetDate: number | null;
  redeemed: boolean;
}

const GET_GIFT_CARDS = `
import GiftCardNFT from 0x0000000000000000

access(all) struct GiftCardView {
  access(all) let id: UInt64
  access(all) let recipient: Address
  access(all) let sender: Address
  access(all) let message: String
  access(all) let principalAmount: UFix64
  access(all) let accruedYield: UFix64
  access(all) let totalValue: UFix64
  access(all) let targetDate: UFix64?
  access(all) let redeemed: Bool

  init(id: UInt64, recipient: Address, sender: Address, message: String, principalAmount: UFix64, accruedYield: UFix64, totalValue: UFix64, targetDate: UFix64?, redeemed: Bool) {
    self.id = id
    self.recipient = recipient
    self.sender = sender
    self.message = message
    self.principalAmount = principalAmount
    self.accruedYield = accruedYield
    self.totalValue = totalValue
    self.targetDate = targetDate
    self.redeemed = redeemed
  }
}

access(all) fun main(accountAddress: Address): [GiftCardView] {
  let account = getAccount(accountAddress)
  let collectionCap = account.capabilities.get<&GiftCardNFT.Collection>(GiftCardNFT.CollectionPublicPath)

  if let collection = collectionCap.borrow() {
    var cards: [GiftCardView] = []
    for id in collection.getIDs() {
      if let card = collection.borrowGiftCard(id) {
        cards.append(
          GiftCardView(
            id: card.id,
            recipient: card.recipient,
            sender: card.sender,
            message: card.message,
            principalAmount: card.principalAmount,
            accruedYield: card.getAccruedYield(),
            totalValue: card.getTotalValue(),
            targetDate: card.targetDate,
            redeemed: card.redeemed
          )
        )
      }
    }
    return cards
  }

  return []
}
`;

export function useGiftCards(accountAddress: string) {
  const [state, setState] = useState<{
    cards: GiftCardView[];
    loading: boolean;
    error: string | null;
  }>({ cards: [], loading: true, error: null });

  const fetchState = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(accountAddress);
    if (!normalizedAddress) {
      return;
    }

    try {
      const result = await fcl.query({
        cadence: withCadenceImports(GET_GIFT_CARDS),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
        ],
      });

      const cards = (result ?? []).map((card: Record<string, string | boolean | null>) => ({
        id: Number(card.id ?? 0),
        recipient: String(card.recipient ?? ''),
        sender: String(card.sender ?? ''),
        message: String(card.message ?? ''),
        principalAmount: parseFloat(String(card.principalAmount ?? '0')),
        accruedYield: parseFloat(String(card.accruedYield ?? '0')),
        totalValue: parseFloat(String(card.totalValue ?? '0')),
        targetDate: card.targetDate === null ? null : parseFloat(String(card.targetDate ?? '0')),
        redeemed: Boolean(card.redeemed),
      }));

      setState({ cards, loading: false, error: null });
    } catch (error) {
      setState({
        cards: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load gift cards',
      });
    }
  }, [accountAddress]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 10_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
