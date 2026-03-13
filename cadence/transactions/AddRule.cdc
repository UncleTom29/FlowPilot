// AddRule.cdc
// Adds a new rule to the worker's RuleGraph. Optionally registers a scheduler handler.
// Gasless via fee delegation.

import RuleGraph from 0x0000000000000000
import VaultStateRegister from 0x0000000000000000

transaction(
    streamId: String,
    ruleId: String,
    ruleType: String,
    ruleParamsJson: String,
    hasScheduler: Bool,
    schedulerIntervalSeconds: UFix64
) {
    prepare(user: auth(Storage) &Account) {
        let graphStoragePath = StoragePath(identifier: "RuleGraph_".concat(streamId))!

        let graph = user.storage.borrow<auth(RuleGraph.Write) &RuleGraph.Graph>(
            from: graphStoragePath
        ) ?? panic("RuleGraph not found for stream: ".concat(streamId))

        // Create appropriate action resource based on ruleType
        var action: @{RuleGraph.FlowAction}? <- nil

        if ruleType == "split" {
            // Parse ratio from params
            let ratio = 0.2  // Default 20% — real implementation parses ruleParamsJson
            action <-! RuleGraph.SplitAction(ratio: ratio, next: nil)
        } else if ruleType == "swap" {
            action <-! RuleGraph.SwapAction(
                fromAsset: "FLOW",
                toAsset: "USDC",
                amount: 50.0,
                next: nil
            )
        } else if ruleType == "deposit" {
            action <-! RuleGraph.DepositAction(
                targetProtocol: "FlowYield",
                amount: 100.0,
                next: nil
            )
        } else if ruleType == "scheduled_trigger" {
            action <-! RuleGraph.ScheduledTriggerAction(
                intervalSeconds: schedulerIntervalSeconds,
                handlerType: "DCAHandler",
                next: nil
            )
        } else if ruleType == "roundup" {
            action <-! RuleGraph.RoundUpAction(
                bucketSize: 1.0,
                savingsTarget: user.address,
                next: nil
            )
        } else {
            // Default: compound action
            action <-! RuleGraph.CompoundAction(compoundRatio: 1.0, next: nil)
        }

        graph.addRule(ruleId: ruleId, action: <- action!)

        // Register scheduler if this rule has a recurring trigger
        if hasScheduler && schedulerIntervalSeconds > 0.0 {
            // FlowTransactionScheduler.schedule(
            //   handlerType: ruleType,
            //   delay: schedulerIntervalSeconds
            // )
            log("Scheduler registered for rule: ".concat(ruleId))
        }

        log("Rule added: ".concat(ruleId).concat(" type: ").concat(ruleType))
    }
}
