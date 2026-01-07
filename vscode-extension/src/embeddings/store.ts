export interface VectorRecord {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, unknown>;
}

export interface VectorMatch extends VectorRecord {
  score: number;
}

export interface VectorQueryFilters {
  metadata?: Record<string, unknown>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  query(embedding: number[], topK: number, filters?: VectorQueryFilters): Promise<VectorMatch[]>;
  delete(ids: string[]): Promise<void>;
  deleteByFilter?(filters: VectorQueryFilters): Promise<void>;
  close?(): Promise<void>;
}

export interface SqlVectorAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

const EPSILON = 1e-8;

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  const dot = a.reduce((sum, value, idx) => sum + value * b[idx], 0);
  const denom = magnitude(a) * magnitude(b);
  return denom < EPSILON ? 0 : dot / denom;
}

function matchesMetadata(record: VectorRecord, filters?: VectorQueryFilters): boolean {
  if (!filters?.metadata) {
    return true;
  }
  return Object.entries(filters.metadata).every(([key, value]) => record.metadata[key] === value);
}

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>();

  async upsert(records: VectorRecord[]): Promise<void> {
    records.forEach((record) => {
      this.records.set(record.id, record);
    });
  }

  async query(embedding: number[], topK: number, filters?: VectorQueryFilters): Promise<VectorMatch[]> {
    const matches: VectorMatch[] = [];

    for (const record of this.records.values()) {
      if (!matchesMetadata(record, filters)) {
        continue;
      }
      matches.push({ ...record, score: cosineSimilarity(record.embedding, embedding) });
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    ids.forEach((id) => this.records.delete(id));
  }

  async deleteByFilter(filters: VectorQueryFilters): Promise<void> {
    for (const record of this.records.values()) {
      if (matchesMetadata(record, filters)) {
        this.records.delete(record.id);
      }
    }
  }
}

interface SqlVectorStoreOptions {
  tableName?: string;
}

abstract class BaseSqlVectorStore implements VectorStore {
  protected readonly adapter: SqlVectorAdapter;
  protected readonly tableName: string;

  constructor(adapter: SqlVectorAdapter, options?: SqlVectorStoreOptions) {
    this.adapter = adapter;
    this.tableName = options?.tableName ?? 'vector_store';
  }

  abstract initialize(): Promise<void>;

  async upsert(records: VectorRecord[]): Promise<void> {
    const sql = `INSERT INTO ${this.tableName} (id, embedding, text, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        embedding = excluded.embedding,
        text = excluded.text,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at`;

    for (const record of records) {
      await this.adapter.execute(sql, [
        record.id,
        this.serializeEmbedding(record.embedding),
        record.text,
        JSON.stringify(record.metadata),
        Date.now()
      ]);
    }
  }

  async query(embedding: number[], topK: number, filters?: VectorQueryFilters): Promise<VectorMatch[]> {
    const rows = await this.adapter.query<{
      id: string;
      embedding: string;
      text: string;
      metadata: string;
    }>(`SELECT id, embedding, text, metadata FROM ${this.tableName}`);

    const candidates = rows
      .map((row) => {
        const record: VectorRecord = {
          id: row.id,
          embedding: this.deserializeEmbedding(row.embedding),
          text: row.text,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        };
        return record;
      })
      .filter((record) => matchesMetadata(record, filters));

    const matches = candidates.map((record) => ({
      ...record,
      score: cosineSimilarity(record.embedding, embedding)
    }));

    return matches.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    await this.adapter.execute(`DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`, ids);
  }

  async deleteByFilter(filters: VectorQueryFilters): Promise<void> {
    const rows = await this.adapter.query<{ id: string; metadata: string }>(
      `SELECT id, metadata FROM ${this.tableName}`
    );
    const ids = rows
      .filter((row) => {
        const metadata = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
        return matchesMetadata({ id: row.id, embedding: [], text: '', metadata }, filters);
      })
      .map((row) => row.id);
    await this.delete(ids);
  }

  protected abstract serializeEmbedding(embedding: number[]): string;
  protected abstract deserializeEmbedding(embedding: string): number[];
}

export class SqliteVectorStore extends BaseSqlVectorStore {
  async initialize(): Promise<void> {
    await this.adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        text TEXT NOT NULL,
        metadata TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    );
  }

  protected serializeEmbedding(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  protected deserializeEmbedding(embedding: string): number[] {
    return JSON.parse(embedding) as number[];
  }
}

export class PgvectorStore extends BaseSqlVectorStore {
  async initialize(): Promise<void> {
    await this.adapter.execute(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        text TEXT NOT NULL,
        metadata TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      )`
    );
  }

  protected serializeEmbedding(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  protected deserializeEmbedding(embedding: string): number[] {
    return JSON.parse(embedding) as number[];
  }
}
