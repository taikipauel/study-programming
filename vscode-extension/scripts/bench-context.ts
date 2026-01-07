import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { chunkDocument } from '../src/context/indexer';
import { InMemoryVectorStore } from '../src/embeddings/store';
import { EmbeddingProvider, buildChunkId, indexDocument, searchAndRerank } from '../src/embeddings/pipeline';

interface BenchOptions {
  filePath: string;
  iterations: number;
  topK: number;
}

class HashEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions = 64) {}

  async embed(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest();
    const vector = new Array(this.dimensions).fill(0);
    for (let i = 0; i < vector.length; i++) {
      vector[i] = (hash[i % hash.length] ?? 0) / 255;
    }
    return vector;
  }
}

function parseArgs(argv: string[]): BenchOptions {
  const options: BenchOptions = {
    filePath: '',
    iterations: 25,
    topK: 5
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file' && argv[i + 1]) {
      options.filePath = argv[i + 1];
      i += 1;
    } else if (arg === '--iterations' && argv[i + 1]) {
      options.iterations = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--topK' && argv[i + 1]) {
      options.topK = Number(argv[i + 1]);
      i += 1;
    }
  }

  if (!options.filePath) {
    throw new Error('Usage: ts-node scripts/bench-context.ts --file <path> [--iterations N] [--topK K]');
  }

  return options;
}

async function runBench(options: BenchOptions): Promise<void> {
  const content = await fs.readFile(options.filePath, 'utf8');
  const chunks = chunkDocument(content);
  const store = new InMemoryVectorStore();
  const embedder = new HashEmbeddingProvider();
  const chunkIds = chunks.map((chunk, index) => buildChunkId(options.filePath, chunk, index));

  const indexStart = performance.now();
  const records = await indexDocument({
    documentId: options.filePath,
    content,
    store,
    embedder
  });
  const indexDuration = performance.now() - indexStart;
  const textToId = new Map(records.map((record) => [record.text, record.id]));

  let totalQueryTime = 0;
  let hits = 0;

  for (let i = 0; i < options.iterations; i += 1) {
    const targetIndex = Math.floor(Math.random() * chunks.length);
    const target = chunks[targetIndex];
    if (!target) {
      continue;
    }

    const queryStart = performance.now();
    const results = await searchAndRerank({
      query: target.text,
      store,
      embedder,
      topK: options.topK,
      rerank: true
    });
    totalQueryTime += performance.now() - queryStart;

    const expectedId = textToId.get(target.text) ?? chunkIds[targetIndex];
    if (expectedId && results.some((result) => result.id === expectedId)) {
      hits += 1;
    }
  }

  const avgQueryTime = totalQueryTime / Math.max(1, options.iterations);
  const hitRate = hits / Math.max(1, options.iterations);

  console.log('Context Bench Results');
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Index time: ${indexDuration.toFixed(2)}ms`);
  console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`);
  console.log(`Hit rate: ${(hitRate * 100).toFixed(1)}%`);
}

runBench(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
