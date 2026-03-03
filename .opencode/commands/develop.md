---
description: Autonomously plan, create issues, and build the PromptCanary MVP
---

Read PRODUCT_SPEC.md for the full product specification. You MUST work completely autonomously — do NOT ask questions or wait for confirmation. Execute ALL phases below in order.

PHASE 1 - PLANNING:
1. Read PRODUCT_SPEC.md thoroughly
2. Choose the optimal tech stack (TypeScript for core, cron/scheduler for continuous monitoring, embedding models for semantic comparison)
3. Design the architecture: test case definition (YAML), scheduler, LLM runner, semantic comparator, alert system, CI/CD GitHub Action
4. Create ARCHITECTURE.md documenting all decisions

PHASE 2 - GITHUB ISSUES:
Create GitHub issues using `gh issue create` for every piece of work. Organize into milestones:
- Milestone 1: Project setup (repo structure, CI/CD, linting, testing)
- Milestone 2: Test case format (YAML/JSON schema for prompt test definitions)
- Milestone 3: Prompt runner (execute prompts against multiple providers)
- Milestone 4: Semantic comparison engine (embedding-based drift detection)
- Milestone 5: Scheduler + alerting (cron-based monitoring, Slack/email/webhook alerts)
- Milestone 6: GitHub Action for CI/CD integration
- Milestone 7: Dashboard + polish (monitoring UI, docs, README)
Each issue must have clear acceptance criteria and labels.

PHASE 3 - DEVELOPMENT:
Build the MVP working through milestones in order. Write clean TypeScript, include tests, commit frequently, push regularly.

Execute all three phases now without stopping.
