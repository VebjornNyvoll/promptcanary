/**
 * Builds a prompt that asks the judge to evaluate content against a custom criterion.
 *
 * The prompt uses chain-of-thought reasoning to produce more reliable judgments
 * and requests structured JSON output.
 */
export function buildCriteriaPrompt(content: string, criteria: string): string {
  return `You are an expert evaluator. Your task is to evaluate the following content against a specific criterion.

## Criterion
${criteria}

## Content to Evaluate
${content}

## Instructions
1. Carefully read the content and the criterion.
2. Think step-by-step about whether the content meets the criterion.
3. Assign a score between 0.0 (completely fails) and 1.0 (perfectly meets the criterion).
4. Provide a concise reason for your score.

You MUST respond with ONLY a JSON object in the following format, no other text:

{"score": <number between 0.0 and 1.0>, "pass": <true if score >= 0.5, false otherwise>, "reason": "<concise explanation>"}`;
}
