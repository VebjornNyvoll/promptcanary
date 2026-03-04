# What is PromptCanary?

PromptCanary is continuous monitoring for prompt behavior in production systems.

Most teams test prompts before shipping. Fewer teams continuously verify those prompts after shipping. That gap is where incidents happen. Providers update models, safety layers shift, tokenization behavior changes, and responses drift quietly until users notice quality drops.

## The problem PromptCanary solves

Prompt behavior can change without any code changes in your application.

- OpenAI had a global disruption on June 10, 2025.
- Anthropic reported elevated errors on August 14, 2025.
- Teams often discover regressions from user complaints, not from monitoring.

If your product depends on prompts, model drift is an uptime risk.

## Testing tools vs monitoring tools

Prompt testing tools are valuable, but they are usually developer-initiated. You run them when you remember, often before release.

PromptCanary is designed as a monitoring tool:

- It runs checks on a schedule, not only on demand.
- It stores historical results so you can detect trends and drift.
- It sends alerts when behavior crosses your thresholds.

PromptCanary complements testing frameworks like Promptfoo and DeepEval by providing autonomous, ongoing verification.

## How PromptCanary works

1. PromptCanary loads your YAML test cases and provider settings.
2. The runner executes each test prompt across target providers.
3. The comparator evaluates structural assertions and optional semantic similarity.
4. Results are stored in SQLite for trend tracking and drift detection.
5. Alert channels dispatch notifications for failures.
6. Scheduler mode repeats this flow on your cron interval for continuous monitoring.

## Who should use PromptCanary

PromptCanary is for any team with prompts in production, including:

- Product teams running user-facing LLM features
- Platform teams maintaining shared prompt infrastructure
- AI engineering teams managing multi-step prompt pipelines
- Teams validating behavior across multiple providers

If prompt behavior affects user experience or business outcomes, PromptCanary gives you an early warning system before issues become incidents.
