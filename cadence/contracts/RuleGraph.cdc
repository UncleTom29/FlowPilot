// RuleGraph.cdc
// Flow Actions compilation target for FlowPilot rule engine.
// Rules are stored as composable action resource chains.

import VaultStateRegister from 0x0000000000000000
import FlowDeFiMathUtils from 0x0000000000000000

access(all) contract RuleGraph {

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Entitlements
    // -----------------------------------------------------------------------
    access(all) entitlement Write
    access(all) entitlement Execute

    // -----------------------------------------------------------------------
    // Storage paths
    // -----------------------------------------------------------------------
    access(all) let StoragePath: StoragePath
    access(all) let PublicPath: PublicPath

    // -----------------------------------------------------------------------
    // FlowAction resource interface — composable action protocol
    // -----------------------------------------------------------------------
    access(all) resource interface FlowAction {
        access(all) fun execute(context: &VaultStateRegister.StateRegister): Void
        access(all) fun getType(): String
        access(all) fun getParams(): {String: String}
    }

    // -----------------------------------------------------------------------
    // SplitAction — splits incoming amount by ratio
    // -----------------------------------------------------------------------
    access(all) resource SplitAction: FlowAction {
        access(all) var ratio: UFix64
        access(all) var nextAction: @{FlowAction}?

        init(ratio: UFix64, next: @{FlowAction}?) {
            self.ratio = ratio
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Apply split ratio to income stream
            // Chain to next action if present
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "split" }
        access(all) fun getParams(): {String: String} {
            return {"ratio": self.ratio.toString()}
        }
    }

    // -----------------------------------------------------------------------
    // SwapAction — executes a DeFi swap
    // -----------------------------------------------------------------------
    access(all) resource SwapAction: FlowAction {
        access(all) var fromAsset: String
        access(all) var toAsset: String
        access(all) var amount: UFix64
        access(all) var nextAction: @{FlowAction}?

        init(fromAsset: String, toAsset: String, amount: UFix64, next: @{FlowAction}?) {
            self.fromAsset = fromAsset
            self.toAsset = toAsset
            self.amount = amount
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Execute swap via DEX integration
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "swap" }
        access(all) fun getParams(): {String: String} {
            return {
                "fromAsset": self.fromAsset,
                "toAsset": self.toAsset,
                "amount": self.amount.toString()
            }
        }
    }

    // -----------------------------------------------------------------------
    // DepositAction — deposits funds into a target protocol
    // -----------------------------------------------------------------------
    access(all) resource DepositAction: FlowAction {
        access(all) var targetProtocol: String
        access(all) var amount: UFix64
        access(all) var nextAction: @{FlowAction}?

        init(targetProtocol: String, amount: UFix64, next: @{FlowAction}?) {
            self.targetProtocol = targetProtocol
            self.amount = amount
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Deposit into yield protocol
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "deposit" }
        access(all) fun getParams(): {String: String} {
            return {"targetProtocol": self.targetProtocol, "amount": self.amount.toString()}
        }
    }

    // -----------------------------------------------------------------------
    // CompoundAction — re-invests accrued yield
    // -----------------------------------------------------------------------
    access(all) resource CompoundAction: FlowAction {
        access(all) var compoundRatio: UFix64
        access(all) var nextAction: @{FlowAction}?

        init(compoundRatio: UFix64, next: @{FlowAction}?) {
            self.compoundRatio = compoundRatio
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Compound yield back into principal
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "compound" }
        access(all) fun getParams(): {String: String} {
            return {"compoundRatio": self.compoundRatio.toString()}
        }
    }

    // -----------------------------------------------------------------------
    // ScheduledTriggerAction — registers with FlowTransactionScheduler
    // -----------------------------------------------------------------------
    access(all) resource ScheduledTriggerAction: FlowAction {
        access(all) var intervalSeconds: UFix64
        access(all) var handlerType: String
        access(all) var nextAction: @{FlowAction}?

        init(intervalSeconds: UFix64, handlerType: String, next: @{FlowAction}?) {
            self.intervalSeconds = intervalSeconds
            self.handlerType = handlerType
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Registers handler with scheduler at specified interval
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "scheduled_trigger" }
        access(all) fun getParams(): {String: String} {
            return {
                "intervalSeconds": self.intervalSeconds.toString(),
                "handlerType": self.handlerType
            }
        }
    }

    // -----------------------------------------------------------------------
    // RoundUpAction — rounds up withdrawals to nearest bucket
    // -----------------------------------------------------------------------
    access(all) resource RoundUpAction: FlowAction {
        access(all) var bucketSize: UFix64
        access(all) var savingsTarget: Address
        access(all) var nextAction: @{FlowAction}?

        init(bucketSize: UFix64, savingsTarget: Address, next: @{FlowAction}?) {
            self.bucketSize = bucketSize
            self.savingsTarget = savingsTarget
            self.nextAction <- next
        }

        access(all) fun execute(context: &VaultStateRegister.StateRegister) {
            // Calculate round-up amount and route to savings
            if let next = &self.nextAction as &{FlowAction}? {
                next.execute(context: context)
            }
        }

        access(all) fun getType(): String { return "roundup" }
        access(all) fun getParams(): {String: String} {
            return {"bucketSize": self.bucketSize.toString()}
        }
    }

    // -----------------------------------------------------------------------
    // RuleGraph resource — stores and executes rule chains
    // -----------------------------------------------------------------------
    access(all) resource Graph {

        access(all) let graphId: String
        access(all) let ownerAddress: Address
        // ruleId → serialized params (action resources stored separately)
        access(all) var ruleParams: {String: {String: String}}
        access(all) var ruleTypes: {String: String}
        // Ordered list of rule IDs
        access(all) var ruleOrder: [String]
        // Action resources stored by ruleId
        access(self) var actions: @{String: {FlowAction}}

        init(graphId: String, owner: Address) {
            self.graphId = graphId
            self.ownerAddress = owner
            self.ruleParams = {}
            self.ruleTypes = {}
            self.ruleOrder = []
            self.actions <- {}
        }

        // Add a rule — requires Write entitlement
        access(Write) fun addRule(ruleId: String, action: @{FlowAction}) {
            pre { self.actions[ruleId] == nil: "Rule already exists" }
            self.ruleTypes[ruleId] = action.getType()
            self.ruleParams[ruleId] = action.getParams()
            self.ruleOrder.append(ruleId)
            let old <- self.actions[ruleId] <- action
            destroy old
            emit RuleAdded(
                streamId: self.graphId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                ruleId: ruleId,
                ruleType: self.ruleTypes[ruleId]!
            )
        }

        // Remove a rule — requires Write entitlement
        access(Write) fun removeRule(ruleId: String) {
            pre { self.actions[ruleId] != nil: "Rule not found" }
            let removed <- self.actions.remove(key: ruleId)!
            destroy removed
            self.ruleParams.remove(key: ruleId)
            self.ruleTypes.remove(key: ruleId)
            let idx = self.ruleOrder.firstIndex(of: ruleId)
            if let i = idx {
                self.ruleOrder.remove(at: i)
            }
            emit RuleRemoved(
                streamId: self.graphId,
                userAddress: self.ownerAddress,
                timestamp: getCurrentBlock().timestamp,
                ruleId: ruleId
            )
        }

        // Execute a specific rule — called by scheduler handlers
        access(Execute) fun executeRule(ruleId: String, context: &VaultStateRegister.StateRegister) {
            if let action = &self.actions[ruleId] as &{FlowAction}? {
                action.execute(context: context)
                emit RuleExecuted(
                    streamId: self.graphId,
                    userAddress: self.ownerAddress,
                    timestamp: getCurrentBlock().timestamp,
                    ruleId: ruleId,
                    success: true
                )
            }
        }

        // Get serialized rule definitions for the NL compiler backend
        access(all) fun getRuleDefinitions(): [{String: String}] {
            var defs: [{String: String}] = []
            for ruleId in self.ruleOrder {
                var def: {String: String} = {"id": ruleId, "type": self.ruleTypes[ruleId] ?? "unknown"}
                let params = self.ruleParams[ruleId] ?? {}
                for key in params.keys {
                    def[key] = params[key]!
                }
                defs.append(def)
            }
            return defs
        }

        access(all) fun getRuleCount(): Int {
            return self.ruleOrder.length
        }
    }

    // -----------------------------------------------------------------------
    // Factory
    // -----------------------------------------------------------------------
    access(all) fun createGraph(graphId: String, owner: Address): @Graph {
        return <- create Graph(graphId: graphId, owner: owner)
    }

    init() {
        self.StoragePath = /storage/RuleGraph
        self.PublicPath = /public/RuleGraph
    }
}
