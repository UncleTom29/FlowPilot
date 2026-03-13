export type RuleType =
  | 'savings_split'
  | 'dca'
  | 'subscription'
  | 'roundup'
  | 'portfolio'
  | 'giftcard'
  | 'lottery_entry';

export interface FlowActionNode {
  type: string;
  params: Record<string, string | number | boolean>;
  next?: FlowActionNode;
}

export interface SchedulerConfig {
  intervalSeconds: number;
  firstFireDelay: number;
  handlerType: string;
}

export interface RuleDefinition {
  id: string;
  type: RuleType;
  rawText: string;
  params: Record<string, string | number | boolean>;
  flowActions: FlowActionNode[];
  schedulerConfig?: SchedulerConfig;
}

export interface ParseError {
  code: 'UNRECOGNIZED_PATTERN' | 'AMBIGUOUS_RULE' | 'INVALID_PARAMS';
  message: string;
  closestMatch?: string;
  suggestion?: string;
  rawText: string;
}

export type ParseResult =
  | { success: true; rule: RuleDefinition }
  | { success: false; error: ParseError };

// Time interval constants (in seconds)
export const INTERVALS = {
  hourly: 3600,
  daily: 86400,
  weekly: 604800,
  monthly: 2592000,  // 30 days
  yearly: 31536000,
} as const;

// Day of week to next-occurrence seconds helper
export const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
