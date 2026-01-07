import { chunkDocument, Chunk } from '../context/indexer';
import {
  VectorMatch,
  VectorRecord,
  VectorStore,
  cosineSimilarity
} from './store';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
}

export interface IndexDocumentOptions {
  documentId: string;
  content: string;
  store: VectorStore;
  embedder: EmbeddingProvider;
  chunker?: (content: string) => Chunk[];
  batchSize?: number;
  resetExisting?: boolean;
}

export interface SearchOptions {
  query: string;
  store: VectorStore;
  embedder: EmbeddingProvider;
  topK?: number;
  rerank?: boolean;
}

export interface RerankedMatch extends VectorMatch {
  rerankScore: number;
}

const DEFAULT_BATCH_SIZE = 16;

export function buildChunkId(documentId: string, chunk: Chunk, index: number): string {
  return `${documentId}:${chunk.type}:${index}:${chunk.start}-${chunk.end}`;
}

async function embedTexts(embedder: EmbeddingProvider, texts: string[]): Promise<number[][]> {
  if (embedder.embedBatch) {
    return embedder.embedBatch(texts);
  }
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedder.embed(text));
  }
  return embeddings;
}

export async function indexDocument(options: IndexDocumentOptions): Promise<VectorRecord[]> {
  const chunker = options.chunker ?? chunkDocument;
  const chunks = chunker(options.content);
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);

  const records: VectorRecord[] = [];

  if (options.resetExisting && options.store.deleteByFilter) {
    await options.store.deleteByFilter({ metadata: { documentId: options.documentId } });
  }

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(
      options.embedder,
      batch.map((chunk) => chunk.text)
    );

    embeddings.forEach((embedding, idx) => {
      const chunk = batch[idx];
      records.push({
        id: buildChunkId(options.documentId, chunk, i + idx),
        embedding,
        text: chunk.text,
        metadata: {
          documentId: options.documentId,
          chunkType: chunk.type,
          start: chunk.start,
          end: chunk.end
        }
      });
    });
  }

  await options.store.upsert(records);
  return records;
}

function keywordOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const candidateTokens = new Set(candidate.toLowerCase().split(/\W+/).filter(Boolean));
  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }
  let overlap = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  });
  return overlap / queryTokens.size;
}

function chunkTypeBoost(metadata: Record<string, unknown>): number {
  const type = metadata.chunkType;
  if (type === 'heading') {
    return 0.08;
  }
  if (type === 'reference') {
    return 0.03;
  }
  if (type === 'caption') {
    return 0.02;
  }
  return 0;
}

export function rerankMatches(query: string, matches: VectorMatch[]): RerankedMatch[] {
  return matches
    .map((match) => {
      const overlapScore = keywordOverlapScore(query, match.text);
      const rerankScore = match.score + overlapScore * 0.15 + chunkTypeBoost(match.metadata);
      return { ...match, rerankScore };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

export async function searchAndRerank(options: SearchOptions): Promise<RerankedMatch[]> {
  const topK = options.topK ?? 6;
  const embedding = await options.embedder.embed(options.query);
  const matches = await options.store.query(embedding, topK * 2);
  if (!options.rerank) {
    return matches.slice(0, topK).map((match) => ({ ...match, rerankScore: match.score }));
  }
  return rerankMatches(options.query, matches).slice(0, topK);
}

export function scoreEmbeddingSimilarity(query: number[], candidate: number[]): number {
  return cosineSimilarity(query, candidate);
}
