export type PiiRedactionLabel =
  | 'email'
  | 'uuid'
  | 'numeric-id'
  | 'user-id';

export interface PiiRedactionRule {
  label: PiiRedactionLabel;
  pattern: RegExp;
  replacement: string;
}

export interface ScrubResult {
  text: string;
  counts: Record<PiiRedactionLabel, number>;
}

const DEFAULT_RULES: PiiRedactionRule[] = [
  {
    label: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED_EMAIL]'
  },
  {
    label: 'uuid',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: '[REDACTED_UUID]'
  },
  {
    label: 'numeric-id',
    pattern: /\b\d{6,}\b/g,
    replacement: '[REDACTED_ID]'
  },
  {
    label: 'user-id',
    pattern: /\b(?:user|account|member|student)[\s:=#-]*[A-Za-z0-9_-]{4,}\b/gi,
    replacement: '[REDACTED_ID]'
  }
];

const buildEmptyCounts = (): Record<PiiRedactionLabel, number> => ({
  email: 0,
  uuid: 0,
  'numeric-id': 0,
  'user-id': 0
});

export function scrubPii(
  input: string,
  rules: PiiRedactionRule[] = DEFAULT_RULES
): ScrubResult {
  let text = input;
  const counts = buildEmptyCounts();

  rules.forEach((rule) => {
    text = text.replace(rule.pattern, () => {
      counts[rule.label] += 1;
      return rule.replacement;
    });
  });

  return { text, counts };
}
