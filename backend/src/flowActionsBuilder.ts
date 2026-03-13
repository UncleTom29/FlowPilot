import { RuleDefinition, FlowActionNode } from './ruleTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Cadence transaction templates
// ─────────────────────────────────────────────────────────────────────────────

export interface CadenceTransaction {
  code: string;
  args: Array<{ type: string; value: unknown }>;
  description: string;
}

/**
 * Build a SplitAction transaction for RuleGraph.addRule
 */
export function buildSplitAction(
  streamId: string,
  ruleId: string,
  ratio: number
): CadenceTransaction {
  const code = `
import RuleGraph from 0x0000000000000000

transaction(streamId: String, ruleId: String, ratio: UFix64) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    let action <- RuleGraph.SplitAction(ratio: ratio, next: nil)
    graph.addRule(ruleId: ruleId, action: <- action)
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: ruleId },
      { type: 'UFix64', value: ratio.toFixed(8) },
    ],
    description: `Add SplitAction rule (${(ratio * 100).toFixed(0)}% split)`,
  };
}

/**
 * Build a SwapAction transaction for DCA rules
 */
export function buildSwapAction(
  streamId: string,
  ruleId: string,
  fromAsset: string,
  toAsset: string,
  amount: number
): CadenceTransaction {
  const code = `
import RuleGraph from 0x0000000000000000

transaction(streamId: String, ruleId: String, fromAsset: String, toAsset: String, amount: UFix64) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    let action <- RuleGraph.SwapAction(fromAsset: fromAsset, toAsset: toAsset, amount: amount, next: nil)
    graph.addRule(ruleId: ruleId, action: <- action)
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: ruleId },
      { type: 'String', value: fromAsset },
      { type: 'String', value: toAsset },
      { type: 'UFix64', value: amount.toFixed(8) },
    ],
    description: `Add SwapAction rule (buy $${amount} ${toAsset})`,
  };
}

/**
 * Build a DepositAction transaction for savings/yield rules
 */
export function buildDepositAction(
  streamId: string,
  ruleId: string,
  targetProtocol: string,
  amount: number
): CadenceTransaction {
  const code = `
import RuleGraph from 0x0000000000000000

transaction(streamId: String, ruleId: String, targetProtocol: String, amount: UFix64) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    let action <- RuleGraph.DepositAction(targetProtocol: targetProtocol, amount: amount, next: nil)
    graph.addRule(ruleId: ruleId, action: <- action)
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: ruleId },
      { type: 'String', value: targetProtocol },
      { type: 'UFix64', value: amount.toFixed(8) },
    ],
    description: `Add DepositAction rule (deposit to ${targetProtocol})`,
  };
}

/**
 * Build a scheduler registration transaction
 */
export function buildSchedulerRegistration(
  streamId: string,
  handlerType: string,
  intervalSeconds: number
): CadenceTransaction {
  const code = `
import RuleGraph from 0x0000000000000000

transaction(streamId: String, handlerType: String, intervalSeconds: UFix64) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    let action <- RuleGraph.ScheduledTriggerAction(
      intervalSeconds: intervalSeconds,
      handlerType: handlerType,
      next: nil
    )
    let ruleId = handlerType.concat("_").concat(getCurrentBlock().timestamp.toString())
    graph.addRule(ruleId: ruleId, action: <- action)
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: handlerType },
      { type: 'UFix64', value: intervalSeconds.toFixed(1) },
    ],
    description: `Register ${handlerType} scheduler (interval: ${intervalSeconds}s)`,
  };
}

/**
 * Convert a full RuleDefinition into an ordered list of Cadence transactions
 * that, when executed in sequence, deploy the complete Flow Actions graph.
 */
export function buildTransactionsFromRule(
  streamId: string,
  rule: RuleDefinition
): CadenceTransaction[] {
  const transactions: CadenceTransaction[] = [];

  for (const action of rule.flowActions) {
    switch (action.type) {
      case 'split':
        transactions.push(
          buildSplitAction(streamId, rule.id, action.params.ratio as number)
        );
        break;

      case 'swap':
        transactions.push(
          buildSwapAction(
            streamId,
            rule.id,
            action.params.fromAsset as string,
            action.params.toAsset as string,
            action.params.amount as number
          )
        );
        break;

      case 'deposit':
        transactions.push(
          buildDepositAction(
            streamId,
            rule.id,
            action.params.targetProtocol as string,
            action.params.amount as number
          )
        );
        break;

      default:
        // Generic AddRule transaction for other action types
        transactions.push(buildGenericRule(streamId, rule.id, action));
    }
  }

  // Register scheduler if configured
  if (rule.schedulerConfig) {
    transactions.push(
      buildSchedulerRegistration(
        streamId,
        rule.schedulerConfig.handlerType,
        rule.schedulerConfig.intervalSeconds
      )
    );
  }

  return transactions;
}

function buildGenericRule(
  streamId: string,
  ruleId: string,
  action: FlowActionNode
): CadenceTransaction {
  const ruleJson = JSON.stringify({ ...action.params, type: action.type });
  const code = `
import RuleGraph from 0x0000000000000000

transaction(streamId: String, ruleId: String, ruleType: String, ruleJson: String) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    let action <- RuleGraph.CompoundAction(compoundRatio: 1.0, next: nil)
    graph.addRule(ruleId: ruleId, action: <- action)
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: ruleId },
      { type: 'String', value: action.type },
      { type: 'String', value: ruleJson },
    ],
    description: `Add ${action.type} rule`,
  };
}
