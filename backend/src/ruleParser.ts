import { parseRule } from './nlCompiler';
import { ParseResult } from './ruleTypes';
import { parseRuleWithLLM } from './llmRuleParser';

export async function parseRuleWithFallback(rawText: string): Promise<ParseResult> {
  const regexResult = parseRule(rawText);
  if (regexResult.success) {
    return regexResult;
  }

  const llmResult = await parseRuleWithLLM(rawText);
  return llmResult ?? regexResult;
}
