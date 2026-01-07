export type GuardrailIssueType = 'citation-mismatch' | 'math-mismatch' | 'code-fence-mismatch';

export interface GuardrailIssue {
  type: GuardrailIssueType;
  message: string;
}

const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const BLOCK_MATH_PATTERN = /\$\$[\s\S]*?\$\$/g;
const INLINE_MATH_PATTERN = /\$(?:\\\$|[^\$])+\$/g;
const CITATION_PATTERN = /【[^】]+】|\[[0-9]+\]/g;

function extractMatches(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}

function compareSegments(
  label: GuardrailIssueType,
  before: string[],
  after: string[]
): GuardrailIssue[] {
  if (before.length !== after.length) {
    return [
      {
        type: label,
        message: `Expected ${before.length} segments but found ${after.length}.`
      }
    ];
  }

  const mismatches = before.filter((value, index) => value !== after[index]);
  if (mismatches.length > 0) {
    return [
      {
        type: label,
        message: `Detected ${mismatches.length} mismatched segments.`
      }
    ];
  }

  return [];
}

export function checkCitationConsistency(original: string, processed: string): GuardrailIssue[] {
  const before = extractMatches(original, CITATION_PATTERN);
  const after = extractMatches(processed, CITATION_PATTERN);
  return compareSegments('citation-mismatch', before, after);
}

export function checkMathPreservation(original: string, processed: string): GuardrailIssue[] {
  const before = [
    ...extractMatches(original, BLOCK_MATH_PATTERN),
    ...extractMatches(original, INLINE_MATH_PATTERN)
  ];
  const after = [
    ...extractMatches(processed, BLOCK_MATH_PATTERN),
    ...extractMatches(processed, INLINE_MATH_PATTERN)
  ];
  return compareSegments('math-mismatch', before, after);
}

export function checkCodeFencePreservation(original: string, processed: string): GuardrailIssue[] {
  const before = extractMatches(original, CODE_FENCE_PATTERN);
  const after = extractMatches(processed, CODE_FENCE_PATTERN);
  return compareSegments('code-fence-mismatch', before, after);
}

export function runGuardrails(original: string, processed: string): GuardrailIssue[] {
  return [
    ...checkCitationConsistency(original, processed),
    ...checkMathPreservation(original, processed),
    ...checkCodeFencePreservation(original, processed)
  ];
}
