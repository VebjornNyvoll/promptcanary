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

/**
 * Builds a ClosedQA-style rubric prompt for evaluating LLM output.
 *
 * Adapted from the autoevals ClosedQA pattern: presents the original input (if available),
 * the submission, and the evaluation criteria, then asks for step-by-step evaluation.
 */
export function buildRubricPrompt(
  content: string,
  criteria: string,
  input?: string,
  threshold?: number,
): string {
  const passThreshold = threshold ?? 0.5;

  const inputSection = input !== undefined ? `\n## Original Input\n${input}\n` : '';

  return `You are an expert evaluator performing a closed-domain quality assessment.
${inputSection}
## Submission
${content}

## Evaluation Criteria
${criteria}

## Instructions
1. Read the submission carefully in the context of the evaluation criteria${input !== undefined ? ' and original input' : ''}.
2. Reason step-by-step about how well the submission meets each aspect of the criteria.
3. Assign a score between 0.0 (completely fails all criteria) and 1.0 (perfectly meets all criteria).
4. Set pass to true if the score is >= ${String(passThreshold)}, false otherwise.
5. Provide a concise reason summarizing your evaluation.

You MUST respond with ONLY a JSON object in the following format, no other text:

{"score": <number between 0.0 and 1.0>, "pass": <true if score >= ${String(passThreshold)}, false otherwise>, "reason": "<concise explanation>"}`;
}
