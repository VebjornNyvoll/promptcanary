# PromptCanary — "Uptime Monitoring for AI Behavior"

> **One-liner:** Runs your test suite against your prompts on a schedule, alerts you before your users notice that a model update broke something.

---

## The Pain

The #1 developer complaint from 100 surveyed developers (MateCloud, Dec 2025):

> *"Prompts that worked yesterday fail today. Silent model behavior changes. Backward-incompatible updates. Undocumented response shifts."*

Real incidents:
- **OpenAI** global disruption June 10, 2025 — no advance warning
- **Anthropic** elevated errors Aug 14, 2025 — no advance warning
- Teams discover regressions from **user complaints**, not monitoring
- Every model update is a potential **production outage**

As teams moved from single-turn GPT calls to 8–15 prompt agentic pipelines, a broken system prompt stopped being an inconvenience and became a production incident.

---

## How It Works

1. **Define prompt test cases** in simple YAML/JSON:
   ```yaml
   - prompt: "Summarize this article..."
     expect:
       format: "bullet_points"
       max_length: 500
       must_contain: ["key_findings"]
       tone: "professional"
   ```
2. **Scheduled runs**: daily/hourly checks against all your prompts across all models
3. **Cross-provider portability testing**: "does this prompt still work on Claude if you're currently using GPT-4?"
4. **Model changelog aggregator**: scrapes provider release notes, community reports, benchmark changes into one feed
5. **Prompt sensitivity scoring**: rates how fragile each prompt is to model changes
6. **Alerts**: Slack/email/webhook when behavior drifts beyond tolerance threshold
7. **CI/CD integration**: GitHub Action for deploy-time regression checks

---

## Why It Doesn't Exist Yet

Testing tools (Promptfoo, DeepEval) are **developer-initiated** — you run them manually. Nobody built **continuous monitoring** that runs autonomously. The insight: this isn't a testing tool, it's a **monitoring** tool. Like uptime monitoring (Pingdom, UptimeRobot) but for prompt behavior. The difference between "run my tests" and "watch my prompts 24/7" is the difference between a test framework and a product.

---

## Monetization

| Tier | Price | Included |
|------|-------|----------|
| Free | $0 | 5 prompts, daily checks |
| Starter | $19/mo | 50 prompts, hourly checks |
| Pro | $79/mo | Unlimited + CI/CD + team |
| Enterprise | $199/mo | Cross-provider testing + priority alerts |

---

## Competition Check

| Competitor | What They Do | Gap |
|-----------|-------------|-----|
| **Promptfoo** | Excellent CLI-first testing | Manual, not continuous monitoring |
| **DeepEval** | Pytest integration for LLMs | Developer-initiated, not autonomous |
| **Braintrust** | Eval features | $249/mo minimum, requires engineering setup |
| **ModelFreeze** (Oracle's variant name) | Same concept with "contract" framing | Validates the idea from independent analysis |

**Key differentiator:** Autonomous, continuous, schedule-based monitoring — not test-on-demand. Plus model changelog aggregation nobody else provides.

---

## Solo-Dev Feasibility

**Rating: High**

- Core: cron job calling LLM APIs + semantic comparisons (embedding cosine similarity) + alerts
- GitHub Action wrapper for CI/CD
- RSS/web scraper for model changelogs
- **Estimated build time: 4–8 weeks to MVP**

---

## Market Size

- 84% of developers use AI tools (Stack Overflow 2025)
- Every team with prompts in production (millions) needs this
- Comparable to uptime monitoring market (Pingdom, UptimeRobot — $100M+ businesses) but for newer, faster-growing market
- SEO keywords: "prompt regression testing," "LLM monitoring," "model drift detection"

---

## Risks

- Promptfoo could add continuous monitoring mode
- OpenAI/Anthropic could improve changelog practices (reducing pain)
- **Moat:** Becoming the daily habit — developers check PromptCanary every morning like they check Sentry. The monitoring data (historical behavior baselines) becomes irreplaceable.

---

## Verdict

| Dimension | Rating |
|-----------|--------|
| Pain Severity | 9/10 |
| Competition | Low |
| Build Effort | Low (4–8 weeks) |
| Revenue Potential | Medium ($19–$199/mo) |
| Confidence | ★★★★★ |

**Strong #2 pick.** Addresses the loudest developer complaint with a simple, buildable product.
