import { useState, useEffect, useCallback } from 'react';
import * as fcl from '@onflow/fcl';
import { safeNormalizeFlowAddress, withCadenceImports } from '../cadenceConfig';

type RuleParamValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: RuleParamValue }
  | RuleParamValue[];

export interface RuleDefinition {
  id: string;
  type: string;
  params: Record<string, RuleParamValue>;
  flowActions: unknown[];
  schedulerConfig?: { intervalSeconds: number; firstFireDelay: number };
  rawText?: string;
}

export interface RulesState {
  rules: RuleDefinition[];
  loading: boolean;
  error: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

function normalizeRuleType(rawType: string): string {
  switch (rawType) {
    case 'split':
      return 'savings_split';
    case 'swap':
      return 'dca';
    default:
      return rawType;
  }
}

function normalizeRuleParams(raw: Record<string, string>): Record<string, RuleParamValue> {
  if (raw.json) {
    try {
      const parsed = JSON.parse(raw.json) as {
        params?: Record<string, RuleParamValue>;
      };
      return parsed.params ?? {};
    } catch {
      return { raw: raw.json };
    }
  }

  switch (raw.type) {
    case 'swap':
      return {
        ...raw,
        asset: raw.toAsset ?? raw.asset ?? 'FLOW',
        intervalText: raw.intervalText ?? 'weekly',
      };
    default:
      return raw;
  }
}

function parseSerializedRule(raw: Record<string, string>): {
  params: Record<string, RuleParamValue>;
  flowActions: unknown[];
  schedulerConfig?: { intervalSeconds: number; firstFireDelay: number };
} {
  if (!raw.json) {
    return { params: normalizeRuleParams(raw), flowActions: [] };
  }

  try {
    const parsed = JSON.parse(raw.json) as {
      params?: Record<string, RuleParamValue>;
      flowActions?: unknown[];
      schedulerConfig?: { intervalSeconds: number; firstFireDelay: number };
    };

    return {
      params: parsed.params ?? {},
      flowActions: parsed.flowActions ?? [],
      schedulerConfig: parsed.schedulerConfig,
    };
  } catch {
    return {
      params: { raw: raw.json },
      flowActions: [],
    };
  }
}

const GET_ACTIVE_RULES = `
import RuleGraph from 0x0000000000000000

access(all) fun main(accountAddress: Address, streamId: String): [{String: String}] {
  let graphCap = getAccount(accountAddress).capabilities.get<&RuleGraph.Graph>(
    PublicPath(identifier: "RuleGraph_".concat(streamId))!
  )
  if let graph = graphCap.borrow() {
    return graph.getRuleDefinitions()
  }
  return []
}
`;

export function useRules(userAddress: string, streamId: string) {
  const [state, setState] = useState<RulesState>({
    rules: [],
    loading: false,
    error: null,
  });

  const fetchRules = useCallback(async () => {
    const normalizedAddress = safeNormalizeFlowAddress(userAddress);
    if (!normalizedAddress) return;

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const rawRules = await fcl.query({
        cadence: withCadenceImports(GET_ACTIVE_RULES),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(normalizedAddress, (t as Record<string, Function>)['Address']),
          (arg as Function)(streamId, (t as Record<string, Function>)['String']),
        ],
      });

      // Parse raw rules from Cadence {String: String} map
      const rules: RuleDefinition[] = (rawRules ?? []).map((raw: Record<string, string>) => {
        const parsed = parseSerializedRule(raw);

        return {
          id: raw.id ?? 'unknown',
          type: normalizeRuleType(raw.type ?? 'unknown'),
          params: parsed.params,
          flowActions: parsed.flowActions,
          schedulerConfig: parsed.schedulerConfig,
          rawText: raw.rawText,
        };
      });

      setState({ rules, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch rules',
      }));
    }
  }, [streamId, userAddress]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /**
   * Parse a natural language rule via the backend NL compiler.
   */
  const parseRule = useCallback(async (text: string) => {
    const res = await fetch(`${BACKEND_URL}/api/parse-rule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  }, []);

  /**
   * Create a rule: compile NL → Flow Actions → deploy to chain.
   */
  const createRule = useCallback(
    async (text: string) => {
      const res = await fetch(`${BACKEND_URL}/api/create-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, streamId, userAddress, relay: true }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchRules();
      }
      return data;
    },
    [streamId, userAddress, fetchRules]
  );

  /**
   * Remove a rule from the RuleGraph.
   */
  const removeRule = useCallback(
    async (ruleId: string) => {
      const cadence = `
import RuleGraph from 0x0000000000000000
transaction(streamId: String, ruleId: String) {
  prepare(user: auth(Storage) &Account) {
    let path = StoragePath(identifier: "RuleGraph_".concat(streamId))!
    let graph = user.storage.borrow<&RuleGraph.Graph>(from: path)
      ?? panic("RuleGraph not found")
    graph.removeRule(ruleId: ruleId)
  }
}`;
      await fcl.mutate({
        cadence: withCadenceImports(cadence),
        args: (arg: unknown, t: unknown) => [
          (arg as Function)(streamId, (t as Record<string, Function>)['String']),
          (arg as Function)(ruleId, (t as Record<string, Function>)['String']),
        ],
        limit: 9999,
      });
      await fetchRules();
    },
    [streamId, fetchRules]
  );

  return {
    ...state,
    parseRule,
    createRule,
    removeRule,
    refetch: fetchRules,
  };
}
