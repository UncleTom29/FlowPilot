// GetActiveRules.cdc
// Returns all active rules from the user's RuleGraph.

import RuleGraph from 0x0000000000000000

access(all) fun main(accountAddress: Address, streamId: String): [{String: String}] {
    let account = getAccount(accountAddress)

    let graphCap = account.capabilities.get<&RuleGraph.Graph>(
        PublicPath(identifier: "RuleGraph_".concat(streamId))!
    )

    if let graph = graphCap.borrow() {
        return graph.getRuleDefinitions()
    }

    return []
}
