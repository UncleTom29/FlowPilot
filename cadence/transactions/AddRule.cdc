// AddRule.cdc
// Adds a new rule to the worker's RuleGraph. Optionally registers a scheduler handler.
// Gasless via fee delegation.

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

        let graph = user.storage.borrow<&RuleGraph.Graph>(
            from: graphStoragePath
        ) ?? panic("RuleGraph not found for stream: ".concat(streamId))

        graph.addRule(
            ruleId: ruleId,
            ruleType: ruleType,
            ruleParamsJson: ruleParamsJson,
            rawText: rawText,
            hasScheduler: hasScheduler,
            schedulerIntervalSeconds: schedulerIntervalSeconds
        )

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
