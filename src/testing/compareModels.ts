import type {
  AssertionResult,
  CompareModelsOptions,
  CompareModelsResult,
  ModelComparisonResult,
} from '../types/index.js';
import type { AssertionDescriptor } from './assertions.js';
import { assertions } from './assertions.js';
import { testPrompt } from './testPrompt.js';

export async function compareModels(
  options: CompareModelsOptions,
  descriptors?: AssertionDescriptor[],
): Promise<CompareModelsResult> {
  if (options.models.length < 2) {
    throw new Error('compareModels requires at least 2 models');
  }

  const promises = options.models.map((modelConfig) =>
    testPrompt({
      provider: modelConfig.provider,
      model: modelConfig.model,
      messages: options.messages,
      apiKey: modelConfig.apiKey,
      baseUrl: modelConfig.baseUrl,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      timeoutMs: options.timeoutMs,
    }),
  );

  const responses = await Promise.all(promises);

  const modelResults: ModelComparisonResult[] = responses.map((response, index) => {
    const modelConfig = options.models[index];
    let passed = true;
    let results: AssertionResult[] = [];

    if (descriptors !== undefined && descriptors.length > 0) {
      const runAllResult = assertions.runAll(response.content, descriptors);
      passed = runAllResult.passed;
      results = runAllResult.results;
    }

    return {
      model: modelConfig.model,
      provider: modelConfig.provider,
      response,
      passed,
      results,
      regressions: [],
    };
  });

  const baseline = modelResults[0];
  const allRegressions: string[] = [];

  for (let i = 1; i < modelResults.length; i += 1) {
    const candidate = modelResults[i];

    if (descriptors !== undefined && descriptors.length > 0) {
      for (let j = 0; j < baseline.results.length; j += 1) {
        const baseResult = baseline.results[j];
        const candResult = candidate.results[j];

        if (baseResult.passed && !candResult.passed) {
          const regression = `${candidate.model} fails "${candResult.type}: ${candResult.expected}" (passed on ${baseline.model})`;
          candidate.regressions.push(regression);
          allRegressions.push(regression);
        }
      }
    }
  }

  return {
    results: modelResults,
    regressions: allRegressions,
    baselineModel: baseline.model,
  };
}
