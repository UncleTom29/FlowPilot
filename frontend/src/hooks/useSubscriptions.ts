import { useCallback, useEffect, useState } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

export interface SubscriptionView {
  subscriptionId: string;
  subscriber: string;
  payee: string;
  amount: number;
  intervalSeconds: number;
  nextPaymentTimestamp: number;
  maxPayments: number | null;
  paymentsCompleted: number;
  active: boolean;
  description: string;
  dueNow: boolean;
}

const GET_SUBSCRIPTION = `
import SubscriptionStream from 0x0000000000000000

access(all) struct SubscriptionView {
  access(all) let subscriptionId: String
  access(all) let subscriber: Address
  access(all) let payee: Address
  access(all) let amount: UFix64
  access(all) let intervalSeconds: UFix64
  access(all) let nextPaymentTimestamp: UFix64
  access(all) let maxPayments: UInt64?
  access(all) let paymentsCompleted: UInt64
  access(all) let active: Bool
  access(all) let description: String
  access(all) let dueNow: Bool

  init(subscriptionId: String, subscriber: Address, payee: Address, amount: UFix64, intervalSeconds: UFix64, nextPaymentTimestamp: UFix64, maxPayments: UInt64?, paymentsCompleted: UInt64, active: Bool, description: String, dueNow: Bool) {
    self.subscriptionId = subscriptionId
    self.subscriber = subscriber
    self.payee = payee
    self.amount = amount
    self.intervalSeconds = intervalSeconds
    self.nextPaymentTimestamp = nextPaymentTimestamp
    self.maxPayments = maxPayments
    self.paymentsCompleted = paymentsCompleted
    self.active = active
    self.description = description
    self.dueNow = dueNow
  }
}

access(all) fun main(accountAddress: Address, subscriptionId: String): SubscriptionView? {
  let account = getAccount(accountAddress)
  let subCap = account.capabilities.get<&SubscriptionStream.Subscription>(
    PublicPath(identifier: "Subscription_".concat(subscriptionId))!
  )

  if let subscription = subCap.borrow() {
    return SubscriptionView(
      subscriptionId: subscription.subscriptionId,
      subscriber: subscription.subscriber,
      payee: subscription.payee,
      amount: subscription.amount,
      intervalSeconds: subscription.intervalSeconds,
      nextPaymentTimestamp: subscription.nextPaymentTimestamp,
      maxPayments: subscription.maxPayments,
      paymentsCompleted: subscription.paymentsCompleted,
      active: subscription.active,
      description: subscription.description,
      dueNow: subscription.isPaymentDue()
    )
  }

  return nil
}
`;

export function useSubscriptions(accountAddress: string, subscriptionIds: string[]) {
  const [state, setState] = useState<{
    subscriptions: SubscriptionView[];
    loading: boolean;
    error: string | null;
  }>({ subscriptions: [], loading: true, error: null });

  const fetchState = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(accountAddress);
    if (!normalizedAddress || subscriptionIds.length === 0) {
      setState({ subscriptions: [], loading: false, error: null });
      return;
    }

    try {
      const subscriptions = await Promise.all(
        subscriptionIds.map(async (subscriptionId) => {
          const result = await fcl.query({
            cadence: withCadenceImports(GET_SUBSCRIPTION),
            args: (arg: unknown, t: unknown) => [
              (arg as Function)(normalizedAddress, (t as Record<string, Function>).Address),
              (arg as Function)(subscriptionId, (t as Record<string, Function>).String),
            ],
          });

          if (!result) {
            return null;
          }

          return {
            subscriptionId: result.subscriptionId,
            subscriber: result.subscriber,
            payee: result.payee,
            amount: parseFloat(result.amount ?? '0'),
            intervalSeconds: parseFloat(result.intervalSeconds ?? '0'),
            nextPaymentTimestamp: parseFloat(result.nextPaymentTimestamp ?? '0'),
            maxPayments: result.maxPayments === null ? null : Number(result.maxPayments ?? 0),
            paymentsCompleted: Number(result.paymentsCompleted ?? 0),
            active: Boolean(result.active),
            description: result.description,
            dueNow: Boolean(result.dueNow),
          } as SubscriptionView;
        })
      );

      setState({
        subscriptions: subscriptions.filter((subscription): subscription is SubscriptionView => Boolean(subscription)),
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        subscriptions: [],
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load subscriptions',
      });
    }
  }, [accountAddress, subscriptionIds]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 15_000);
    return () => clearInterval(interval);
  }, [fetchState]);

  return { ...state, refetch: fetchState };
}
