import { PromptTemplate } from './prompts';

export type PromptStrategyKind = 'lightweight' | 'standard' | 'chunked';

export interface PromptStrategyOptions {
  shortTextThreshold?: number;
  longTextThreshold?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface PromptChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

export type PromptStrategyResult =
  | {
      strategy: 'lightweight' | 'standard';
      system: string;
      user: string;
      tokenEstimate: number;
    }
  | {
      strategy: 'chunked';
      system: string;
      chunkTemplate: string;
      chunks: PromptChunk[];
      tokenEstimate: number;
    };

const INPUT_PLACEHOLDER = '{{input}}';

const DEFAULT_STRATEGY_OPTIONS: Required<PromptStrategyOptions> = {
  shortTextThreshold: 120,
  longTextThreshold: 900,
  chunkSize: 240,
  chunkOverlap: 40
};

const estimateTokens = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

const renderUserTemplate = (template: string, input: string): string => {
  if (template.includes(INPUT_PLACEHOLDER)) {
    return template.replace(INPUT_PLACEHOLDER, input);
  }
  return `${template}\n${input}`;
};

const splitIntoChunks = (
  text: string,
  chunkSize: number,
  chunkOverlap: number
): PromptChunk[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ index: 0, content: text, tokenEstimate: 0 }];
  }

  const chunks: PromptChunk[] = [];
  const step = Math.max(1, chunkSize - chunkOverlap);
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + chunkSize);
    if (slice.length === 0) {
      break;
    }
    const content = slice.join(' ');
    chunks.push({ index: chunks.length, content, tokenEstimate: slice.length });
  }

  return chunks;
};

export const resolvePromptStrategy = (
  input: string,
  template: PromptTemplate,
  options: PromptStrategyOptions = {}
): PromptStrategyResult => {
  const resolvedOptions = { ...DEFAULT_STRATEGY_OPTIONS, ...options };
  const tokenEstimate = estimateTokens(input);

  if (tokenEstimate <= resolvedOptions.shortTextThreshold) {
    return {
      strategy: 'lightweight',
      system: `${template.system}\nKeep responses concise and focused on the request.`,
      user: renderUserTemplate(template.user, input),
      tokenEstimate
    };
  }

  if (tokenEstimate >= resolvedOptions.longTextThreshold) {
    return {
      strategy: 'chunked',
      system: template.system,
      chunkTemplate: renderUserTemplate(template.user, '{{chunk}}'),
      chunks: splitIntoChunks(
        input,
        resolvedOptions.chunkSize,
        resolvedOptions.chunkOverlap
      ),
      tokenEstimate
    };
  }

  return {
    strategy: 'standard',
    system: template.system,
    user: renderUserTemplate(template.user, input),
    tokenEstimate
  };
};
