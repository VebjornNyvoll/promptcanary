---
layout: home
hero:
  name: PromptCanary
  text: Test your prompts like you test your code
  tagline: Catch model drift before your users do. Add prompt regression tests to your existing test suite — Vitest, Jest, or any JavaScript test runner.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/VebjornNyvoll/promptcanary
features:
  - title: Works With Any Test Runner
    details: Regular functions that work in Vitest, Jest, Mocha, or any runner. No proprietary test format, no separate tool.
    icon: ✅
  - title: Multi-Provider Testing
    details: Test across OpenAI, Anthropic, and Google Gemini simultaneously. Catch provider-specific regressions.
    icon: 🔀
  - title: Semantic Similarity
    details: Go beyond string matching. Embedding-based comparison detects subtle meaning shifts in responses.
    icon: 🧠
  - title: Built-in Assertions
    details: contains, notContains, maxLength, minLength, matchesRegex, isJson, matchesJsonSchema, plus runAll() for batch checks.
    icon: 🔍
  - title: CI/CD Native
    details: Runs wherever your tests run. GitHub Actions, GitLab CI, any pipeline. Non-zero exit on failures.
    icon: ⚡
  - title: Zero Infrastructure
    details: One npm package. No servers, no dashboards, no separate tools to manage.
    icon: 📦
---
