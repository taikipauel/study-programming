import { ClientRequestOptions, LlmClient, LogPolicy, RetryConfig } from './client';

export type LocalProviderKind = 'openai-compatible' | 'llama.cpp' | 'ollama';

export interface LocalClientConfig {
  baseUrl?: string;
  kind?: LocalProviderKind;
  timeoutMs?: number;
  retry?: RetryConfig;
  logPolicy?: LogPolicy;
}

type OllamaResponse = {
  model?: string;
  created_at?: string;
  message?: { role: string; content: string };
  response?: string;
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  retryableStatusCodes: [408, 409, 425, 429, 500, 502, 503, 504]
};

const DEFAULT_TIMEOUT_MS = 20000;

const DEFAULT_BASE_URLS: Record<LocalProviderKind, string> = {
  'openai-compatible': 'http://localhost:8080',
  'llama.cpp': 'http://localhost:8080',
  ollama: 'http://localhost:11434'
};

const normalizeBaseUrl = (baseUrl: string, kind: LocalProviderKind): string => {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (kind === 'ollama') {
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
};

const mapLocalPath = (kind: LocalProviderKind, path: string): string => {
  if (kind !== 'ollama') {
    return path;
  }

  if (path.startsWith('/chat/completions')) {
    return '/chat';
  }
  if (path.startsWith('/completions')) {
    return '/generate';
  }
  if (path.startsWith('/models')) {
    return '/tags';
  }

  return path;
};

const normalizeOllamaResponse = (data: OllamaResponse, mappedPath: string) => {
  const created = data.created_at ? Date.parse(data.created_at) / 1000 : Math.floor(Date.now() / 1000);
  const content =
    mappedPath === '/chat'
      ? data.message?.content ?? ''
      : data.response ?? data.message?.content ?? '';

  return {
    id: `ollama-${Date.now()}`,
    object: 'chat.completion',
    created,
    model: data.model ?? 'ollama',
    choices: [
      {
        index: 0,
        message: {
          role: data.message?.role ?? 'assistant',
          content
        },
        finish_reason: data.done ? 'stop' : 'length'
      }
    ],
    usage: {
      prompt_tokens: data.prompt_eval_count ?? 0,
      completion_tokens: data.eval_count ?? 0,
      total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0)
    }
  };
};

const jitterDelay = (baseMs: number): number => {
  const jitter = Math.random() * baseMs * 0.2;
  return Math.round(baseMs + jitter);
};

const buildBackoffDelay = (attempt: number, config: Required<RetryConfig>): number => {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  return Math.min(config.maxDelayMs, jitterDelay(exponential));
};

const buildErrorMessage = (
  status: number,
  statusText: string,
  responseBody?: string,
  logPolicy?: LogPolicy
): string => {
  const includeBody = logPolicy?.includeResponseBody ?? false;
  const base = `Local LLM request failed (${status}): ${statusText || 'unknown error'}`;
  if (!includeBody || !responseBody) {
    return base;
  }
  return `${base} :: ${responseBody}`;
};

export const createLocalClient = (config: LocalClientConfig = {}): LlmClient => {
  const kind: LocalProviderKind = config.kind ?? 'openai-compatible';
  const baseUrl = normalizeBaseUrl(
    config.baseUrl ?? DEFAULT_BASE_URLS[kind],
    kind
  );
  const retryConfig: Required<RetryConfig> = { ...DEFAULT_RETRY, ...config.retry };

  const request = async <T>(
    path: string,
    options: ClientRequestOptions = {}
  ): Promise<T> => {
    const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const mappedPath = mapLocalPath(kind, path.startsWith('/') ? path : `/${path}`);
    const url = `${baseUrl}${mappedPath}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
          method: options.method ?? 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers ?? {})
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });
        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const error = new Error(
            buildErrorMessage(
              response.status,
              response.statusText,
              await response.text(),
              config.logPolicy
            )
          );
          if (
            attempt < retryConfig.maxRetries &&
            retryConfig.retryableStatusCodes.includes(response.status)
          ) {
            const delay = buildBackoffDelay(attempt, retryConfig);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }

        const contentType = response.headers.get('content-type') ?? '';
        const payload = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        if (kind === 'ollama' && (mappedPath === '/chat' || mappedPath === '/generate')) {
          return normalizeOllamaResponse(payload as OllamaResponse, mappedPath) as T;
        }

        return payload as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retryConfig.maxRetries) {
          const delay = buildBackoffDelay(attempt, retryConfig);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Local LLM request failed after retries');
  };

  return {
    provider: 'local',
    request
  };
};
