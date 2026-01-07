interface ProtectionResult {
  text: string;
  placeholders: string[];
}

const PLACEHOLDER_PREFIX = '__LLM_PROTECTED__';

function protectSegments(text: string, pattern: RegExp, placeholders: string[]): ProtectionResult {
  let index = placeholders.length;
  const updated = text.replace(pattern, (match) => {
    const token = `${PLACEHOLDER_PREFIX}${index}__`;
    placeholders.push(match);
    index += 1;
    return token;
  });

  return { text: updated, placeholders };
}

function restoreSegments(text: string, placeholders: string[]): string {
  let restored = text;
  placeholders.forEach((value, index) => {
    const token = `${PLACEHOLDER_PREFIX}${index}__`;
    restored = restored.replaceAll(token, value);
  });
  return restored;
}

const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const BLOCK_MATH_PATTERN = /\$\$[\s\S]*?\$\$/g;
const INLINE_MATH_PATTERN = /\$(?:\\\$|[^\$])+\$/g;
const CITATION_PATTERN = /【[^】]+】|\[[0-9]+\]/g;

function cleanupMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface PostprocessOptions {
  protectCitations?: boolean;
  protectMath?: boolean;
  protectCodeFences?: boolean;
}

export function postprocessResponse(
  input: string,
  options: PostprocessOptions = {}
): string {
  const protectCitations = options.protectCitations ?? true;
  const protectMath = options.protectMath ?? true;
  const protectCodeFences = options.protectCodeFences ?? true;

  const placeholders: string[] = [];
  let working = input;

  if (protectCodeFences) {
    ({ text: working } = protectSegments(working, CODE_FENCE_PATTERN, placeholders));
  }

  if (protectMath) {
    ({ text: working } = protectSegments(working, BLOCK_MATH_PATTERN, placeholders));
    ({ text: working } = protectSegments(working, INLINE_MATH_PATTERN, placeholders));
  }

  if (protectCitations) {
    ({ text: working } = protectSegments(working, CITATION_PATTERN, placeholders));
  }

  const cleaned = cleanupMarkdown(working);
  return restoreSegments(cleaned, placeholders);
}
