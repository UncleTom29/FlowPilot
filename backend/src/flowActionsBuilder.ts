import { RuleDefinition } from './ruleTypes';
import { withCadenceImports } from './cadenceImports';

export interface CadenceTransaction {
  code: string;
  args: Array<{ type: string; value: unknown }>;
  description: string;
}

function toCadenceUFix64(value: number | undefined, decimals = 1): string {
  return Number(value ?? 0).toFixed(decimals);
}

function buildSerializedRule(rule: RuleDefinition): string {
  return JSON.stringify({
    type: rule.type,
    params: rule.params,
    flowActions: rule.flowActions,
    schedulerConfig: rule.schedulerConfig ?? null,
  });
}

function buildTransactionCode(): string {
  return withCadenceImports(`
import RuleGraph from 0x0000000000000000

transaction(
  streamId: String,
  ruleId: String,
  ruleType: String,
  ruleParamsJson: String,
  rawText: String,
  hasScheduler: Bool,
  schedulerIntervalSeconds: UFix64
) {
  prepare(user: auth(Storage) &Account) {
    let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<&RuleGraph.Graph>(from: graphStoragePath)
      ?? panic("RuleGraph not found")

    graph.addRule(
      ruleId: ruleId,
      ruleType: ruleType,
      ruleParamsJson: ruleParamsJson,
      rawText: rawText,
      hasScheduler: hasScheduler,
      schedulerIntervalSeconds: schedulerIntervalSeconds
    )

    if hasScheduler {
      log("Scheduler metadata stored with interval: ".concat(schedulerIntervalSeconds.toString()))
    }
  }
}`);
}

export function buildTransactionsFromRule(
  streamId: string,
  rule: RuleDefinition
): CadenceTransaction[] {
  return [
    {
      code: buildTransactionCode(),
      args: [
        { type: 'String', value: streamId },
        { type: 'String', value: rule.id },
        { type: 'String', value: rule.type },
        { type: 'String', value: buildSerializedRule(rule) },
        { type: 'String', value: rule.rawText },
        { type: 'Bool', value: Boolean(rule.schedulerConfig) },
        {
          type: 'UFix64',
          value: toCadenceUFix64(rule.schedulerConfig?.intervalSeconds),
        },
      ],
      description: `Deploy ${rule.type} automation to RuleGraph`,
    },
  ];
}
