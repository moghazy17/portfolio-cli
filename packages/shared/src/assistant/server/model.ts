import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createFallbackModel, type FallbackModelOptions } from './fallback';

export function createAssistantModel(
  env: Record<string, string | undefined> = process.env,
  hooks?: Pick<FallbackModelOptions, 'onFallback'>,
) {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
  return createFallbackModel({
    primary: openai(env.ASSISTANT_MODEL || 'gpt-6-luna'),
    fallback: env.GOOGLE_GENERATIVE_AI_API_KEY
      ? google(env.ASSISTANT_FALLBACK_MODEL || 'gemini-3.5-flash-lite')
      : undefined,
    ...hooks,
  });
}
