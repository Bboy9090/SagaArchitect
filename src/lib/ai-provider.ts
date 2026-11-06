import OpenAI from 'openai';

export type AiProviderName = 'openai' | 'gemini' | 'groq';

type ProviderConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
  defaultHeaders?: Record<string, string>;
};

const PROVIDERS: Record<AiProviderName, () => ProviderConfig | null> = {
  openai: () => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      apiKey,
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    };
  },
  gemini: () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
      defaultHeaders: {
        'x-goog-api-client': 'phoenix-creator-studio-oai/0.1.0',
      },
    };
  },
  groq: () => {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b',
    };
  },
};

function explicitProvider(): AiProviderName | null | undefined {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'openai' || raw === 'gemini' || raw === 'groq') return raw;
  return null;
}

export function configuredAiProviderName(): AiProviderName | null {
  const requested = explicitProvider();
  if (requested === null) return null;
  if (requested) return PROVIDERS[requested]() ? requested : null;

  for (const provider of ['openai', 'gemini', 'groq'] as const) {
    if (PROVIDERS[provider]()) return provider;
  }
  return null;
}

export function hasConfiguredAiProvider(): boolean {
  return configuredAiProviderName() !== null;
}

export function getAiProvider(): {
  client: OpenAI;
  model: string;
  provider: AiProviderName;
} {
  const provider = configuredAiProviderName();
  if (!provider) {
    throw new Error('No supported AI provider is configured.');
  }

  const config = PROVIDERS[provider]();
  if (!config) {
    throw new Error(`AI provider "${provider}" is selected but its API key is unavailable.`);
  }

  return {
    provider,
    model: config.model,
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
    }),
  };
}
