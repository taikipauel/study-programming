export type ProviderType = 'openai' | 'azure' | 'local';

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
}

export interface ProviderConfig {
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  plusToken?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  timeoutMs?: number;
  retry?: RetryConfig;
}

export interface ClientRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface LlmClient {
  provider: ProviderType;
  request<T = unknown>(path: string, options?: ClientRequestOptions): Promise<T>;
}

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 350,
  maxDelayMs: 4000,
  retryableStatusCodes: [408, 409, 425, 429, 500, 502, 503, 504]
};

const DEFAULT_TIMEOUT_MS = 20000;

function jitterDelay(baseMs: number): number {
  const jitter = Math.random() * baseMs * 0.2;
  return Math.round(baseMs + jitter);
}

function buildBackoffDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponential = config.baseDelayMs * Math.pow(2, attempt);
  return Math.min(config.maxDelayMs, jitterDelay(exponential));
}

function buildHeaders(config: ProviderConfig, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const token = config.apiKey ?? config.plusToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      headers[key] = value;
    });
  }

  return headers;
}

function normalizeBaseUrl(config: ProviderConfig): string {
  if (config.baseUrl) {
    return config.baseUrl.replace(/\/+$/, '');
  }

  if (config.type === 'azure') {
    if (!config.azureDeployment) {
      throw new Error('Azure provider requires azureDeployment');
    }
    return `https://${config.azureDeployment}.openai.azure.com`;
  }

  return 'https://api.openai.com/v1';
}

function buildUrl(config: ProviderConfig, path: string): string {
  const baseUrl = normalizeBaseUrl(config);
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;

  if (config.type === 'azure') {
    const apiVersion = config.azureApiVersion ?? '2024-02-15-preview';
    const azurePath = trimmedPath.startsWith('/openai')
      ? trimmedPath
      : `/openai${trimmedPath}`;
    const separator = azurePath.includes('?') ? '&' : '?';
    return `${baseUrl}${azurePath}${separator}api-version=${encodeURIComponent(apiVersion)}`;
  }

  return `${baseUrl}${trimmedPath}`;
}

async function requestWithRetry<T>(
  config: ProviderConfig,
  path: string,
  options: ClientRequestOptions = {}
): Promise<T> {
  const retryConfig: Required<RetryConfig> = { ...DEFAULT_RETRY, ...config.retry };
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(buildUrl(config, path), {
        method: options.method ?? 'POST',
        headers: buildHeaders(config, options.headers),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `LLM request failed (${response.status}): ${errorText || response.statusText}`
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
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retryConfig.maxRetries) {
        const delay = buildBackoffDelay(attempt, retryConfig);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError ?? new Error('LLM request failed after retries');
}

export function createLlmClient(config: ProviderConfig): LlmClient {
  return {
    provider: config.type,
    request: <T>(path: string, options?: ClientRequestOptions) =>
      requestWithRetry<T>(config, path, options)
  };
}
