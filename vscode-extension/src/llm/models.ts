import { LlmClient } from './client';

export interface ModelInfo {
  id: string;
  owned_by?: string;
  status?: string;
  available?: boolean;
  permission?: Array<Record<string, unknown>>;
}

interface ModelsResponse {
  data?: ModelInfo[];
}

export interface ModelCacheEntry {
  models: ModelInfo[];
  expiresAt: number;
}

export interface FetchModelsOptions {
  client: LlmClient;
  cacheTtlMs?: number;
  filterUnavailable?: boolean;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const modelCache = new Map<string, ModelCacheEntry>();

function cacheKey(client: LlmClient): string {
  return client.provider;
}

function hasPositivePermission(model: ModelInfo): boolean {
  if (!model.permission || model.permission.length === 0) {
    return true;
  }
  return model.permission.some((permission) => {
    const record = permission as Record<string, unknown>;
    return (
      record.allow_create_engine === true ||
      record.allow_sampling === true ||
      record.allow_view === true
    );
  });
}

function isModelAvailable(model: ModelInfo): boolean {
  if (model.available === false) {
    return false;
  }
  if (model.status && model.status !== 'available') {
    return false;
  }
  return hasPositivePermission(model);
}

export async function fetchModels(options: FetchModelsOptions): Promise<ModelInfo[]> {
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const key = cacheKey(options.client);
  const now = Date.now();
  const cached = modelCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.models;
  }

  const response = await options.client.request<ModelsResponse>('/models', { method: 'GET' });
  const models = response.data ?? [];
  const filtered = options.filterUnavailable === false
    ? models
    : models.filter((model) => isModelAvailable(model));

  modelCache.set(key, { models: filtered, expiresAt: now + ttl });
  return filtered;
}

export function clearModelCache(): void {
  modelCache.clear();
}
