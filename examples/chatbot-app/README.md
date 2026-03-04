# Chatbot App Prompt Tests

This standalone example demonstrates how to test realistic chatbot behaviors with PromptCanary and Vitest.

## What this example demonstrates

- `testPrompt` for live LLM prompt execution in tests
- Assertion helpers: `contains`, `notContains`, `maxLength`, `minLength`, `matchesRegex`, `isJson`, `matchesJsonSchema`
- `semanticSimilarity` for meaning-based validation
- Multi-provider testing (OpenAI + Anthropic)
- Batch assertion checks with `assertions.runAll`

## Prerequisites

- Node.js 20+
- An OpenAI API key
- An Anthropic API key

## Setup

```bash
cd examples/chatbot-app
npm install
cp .env.example .env
```

Then edit `.env` and add your real keys:

```bash
OPENAI_API_KEY=your_real_openai_key
ANTHROPIC_API_KEY=your_real_anthropic_key
```

## Running tests

```bash
npm test
```

## Test files

- `tests/refund-policy.test.ts`
  - Validates policy responses using core assertions and `runAll`
- `tests/greeting.test.ts`
  - Checks friendly greeting quality with `semanticSimilarity`
  - Compares response consistency across OpenAI and Anthropic
- `tests/json-extraction.test.ts`
  - Validates structured extraction with `isJson` and `matchesJsonSchema`

## Learn more

See the main PromptCanary docs in the repository root: `README.md`.
