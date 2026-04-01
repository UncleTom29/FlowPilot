// RuleGraph.cdc
// Serialized rule storage for FlowPilot automations.

access(all) contract RuleGraph {

    access(all) event RuleAdded(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        ruleId: String,
        ruleType: String
    )
    access(all) event RuleExecuted(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        ruleId: String,
        success: Bool
    )
    access(all) event RuleRemoved(
        streamId: String,
        userAddress: Address,
        timestamp: UFix64,
        ruleId: String
    )

    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    access(all) resource Graph {

        access(all) let graphId: String
        access(all) let ownerAddress: Address
        access(all) var ruleTypes: {String: String}
        access(all) var rulePayloads: {String: String}
        access(all) var ruleRawTexts: {String: String}
        access(all) var ruleHasScheduler: {String: Bool}
        access(all) var ruleIntervals: {String: UFix64}
        access(all) var ruleOrder: [String]

        init(graphId: String, owner: Address) {
            self.graphId = graphId
            self.ownerAddress = owner
            self.ruleTypes = {}
            self.rulePayloads = {}
            self.ruleRawTexts = {}
            self.ruleHasScheduler = {}
            self.ruleIntervals = {}
            self.ruleOrder = []
        }

        access(all) fun addRule(
            ruleId: String,
            ruleType: String,
            ruleParamsJson: String,
            rawText: String,
            hasScheduler: Bool,
            schedulerIntervalSeconds: UFix64
        ) {
            assert(self.ruleTypes[ruleId] == nil, message: "Rule already exists")

            self.ruleTypes[ruleId] = ruleType
            self.rulePayloads[ruleId] = ruleParamsJson
            self.ruleRawTexts[ruleId] = rawText
            self.ruleHasScheduler[ruleId] = hasScheduler
            self.ruleIntervals[ruleId] = schedulerIntervalSeconds
            self.ruleOrder.append(ruleId)

            emit RuleAdded(
                streamId: self.graphId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                ruleId: ruleId,
                ruleType: ruleType
            )
        }

        access(all) fun removeRule(ruleId: String) {
            assert(self.ruleTypes[ruleId] != nil, message: "Rule not found")

            self.ruleTypes.remove(key: ruleId)
            self.rulePayloads.remove(key: ruleId)
            self.ruleRawTexts.remove(key: ruleId)
            self.ruleHasScheduler.remove(key: ruleId)
            self.ruleIntervals.remove(key: ruleId)

            if let index = self.ruleOrder.firstIndex(of: ruleId) {
                self.ruleOrder.remove(at: index)
            }

            emit RuleRemoved(
                streamId: self.graphId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                ruleId: ruleId
            )
        }

        access(all) fun recordExecution(ruleId: String, success: Bool) {
            assert(self.ruleTypes[ruleId] != nil, message: "Rule not found")

            emit RuleExecuted(
                streamId: self.graphId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                ruleId: ruleId,
                success: success
            )
        }

        access(all) fun getRuleDefinitions(): [{String: String}] {
            var defs: [{String: String}] = []

            for ruleId in self.ruleOrder {
                var hasScheduler = "false"
                if self.ruleHasScheduler[ruleId] == true {
                    hasScheduler = "true"
                }

                let definition: {String: String} = {
                    "id": ruleId,
                    "type": self.ruleTypes[ruleId] ?? "unknown",
                    "json": self.rulePayloads[ruleId] ?? "{}",
                    "rawText": self.ruleRawTexts[ruleId] ?? "",
                    "hasScheduler": hasScheduler,
                    "schedulerIntervalSeconds": (self.ruleIntervals[ruleId] ?? 0.0).toString()
                }

                defs.append(definition)
            }

            return defs
        }

        access(all) fun getRuleCount(): Int {
            return self.ruleOrder.length
        }
    }

    access(all) fun createGraph(graphId: String, owner: Address): @Graph {
        return <- create Graph(graphId: graphId, owner: owner)
    }

    init() {
        self.StoragePath = /storage/RuleGraph
        self.PublicPath = /public/RuleGraph
    }
}
