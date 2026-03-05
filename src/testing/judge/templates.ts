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

export function buildFactualityPrompt(content: string, input: string, expected: string): string {
  return `You are an expert factuality evaluator. Compare the submission against the expert reference answer.

## Question
${input}

## Expert Reference Answer
${expected}

## Submission
${content}

## Classification
Choose exactly one category:

(A) The submission is a subset of the expert answer and is fully consistent with it.
(B) The submission is a superset of the expert answer and is fully consistent with it.
(C) The submission contains all the same details as the expert answer.
(D) There is a disagreement between the submission and the expert answer.
(E) The answers differ, but these differences don't matter from a factual standpoint.

## Scoring
- (A) Subset, consistent → score 0.4
- (B) Superset, consistent → score 0.6
- (C) Same details → score 1.0
- (D) Disagreement → score 0.0
- (E) Differs, not factually → score 1.0

## Instructions
1. Compare the submission to the expert reference answer in the context of the question.
2. Determine which category (A-E) best describes the relationship.
3. Assign the corresponding score.
4. Set pass based on whether the score meets the threshold (score > 0).

You MUST respond with ONLY a JSON object in the following format, no other text:

{"score": <number>, "pass": <boolean>, "reason": "<which category (A-E) and why>"}`;
}

export function buildAnswerRelevancePrompt(
  content: string,
  input: string,
  threshold: number,
): string {
  return `You are an expert evaluator assessing answer relevance. Determine how well the submission addresses the original question.

## Original Question
${input}

## Submission
${content}

## Evaluation Criteria
Score the submission from 0.0 to 1.0 based on:
- **Directness**: Does the submission directly answer the question asked?
- **Completeness**: Does it cover the key aspects of the question?
- **Focus**: Is the response focused on the question without excessive tangents?

Deduct points for:
- Off-topic content that doesn't address the question
- Excessive preamble or filler before the actual answer
- Missing the core intent of the question
- Answering a different question than what was asked

## Instructions
1. Read the question and submission carefully.
2. Evaluate directness, completeness, and focus.
3. Assign a score between 0.0 (completely irrelevant) and 1.0 (perfectly relevant and complete).
4. Set pass to true if score >= ${String(threshold)}, false otherwise.

You MUST respond with ONLY a JSON object in the following format, no other text:

{"score": <number between 0.0 and 1.0>, "pass": <true if score >= ${String(threshold)}>, "reason": "<concise explanation>"}`;
}

export function buildFaithfulnessPrompt(
  content: string,
  context: string,
  threshold: number,
): string {
  return `You are an expert evaluator assessing faithfulness. Determine whether the submission stays faithful to the provided context without hallucinating.

## Reference Context
${context}

## Submission
${content}

## Instructions
1. Extract all factual claims from the submission.
2. For each claim, check whether it is supported by the reference context.
3. Calculate the faithfulness score: (number of supported claims) / (total claims).
   - If the submission makes no factual claims, score 1.0.
   - If all claims are supported by the context, score 1.0.
   - If some claims are unsupported or contradicted by the context, reduce the score proportionally.
4. Set pass to true if score >= ${String(threshold)}, false otherwise.
5. In your reason, mention any unsupported or hallucinated claims.

You MUST respond with ONLY a JSON object in the following format, no other text:

{"score": <number between 0.0 and 1.0>, "pass": <true if score >= ${String(threshold)}>, "reason": "<concise explanation listing any unsupported claims>"}`;
}
