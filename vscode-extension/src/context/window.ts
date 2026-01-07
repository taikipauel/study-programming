export interface ContextSelectionOptions {
  radius: number;
  maxTotalChars?: number;
  prioritizeCitations?: boolean;
}

export interface SelectedParagraph {
  index: number;
  text: string;
  hasCitation: boolean;
}

const citationRegex = /\[[0-9]{1,3}\]|\([A-Za-z][^)]+?\d{4}\)/;
const MIN_PARAGRAPH_LENGTH = 80;

function containsCitation(text: string): boolean {
  return citationRegex.test(text);
}

function distanceFromCursor(index: number, cursor: number): number {
  return Math.abs(index - cursor);
}

function totalLength(paragraphs: SelectedParagraph[]): number {
  if (paragraphs.length === 0) {
    return 0;
  }

  const combined = paragraphs.reduce((length, para) => length + para.text.length, 0);
  const separators = (paragraphs.length - 1) * 2; // "\n\n" between paragraphs
  return combined + separators;
}

function trimParagraph(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, Math.max(0, maxLength - 1)) + '…';
}

function enforceBudget(
  paragraphs: SelectedParagraph[],
  cursorIndex: number,
  maxTotalChars: number
): SelectedParagraph[] {
  let working = [...paragraphs];

  const farthestParagraph = (preferredNonCitation: boolean): number => {
    let candidateIndex = -1;
    let maxDistance = -1;

    working.forEach((para, idx) => {
      if (preferredNonCitation && para.hasCitation) {
        return;
      }
      const distance = distanceFromCursor(para.index, cursorIndex);
      if (distance > maxDistance) {
        maxDistance = distance;
        candidateIndex = idx;
      }
    });

    return candidateIndex;
  };

  while (totalLength(working) > maxTotalChars && working.length > 0) {
    const preferNonCitation = working.some((p) => !p.hasCitation);
    const idx = farthestParagraph(preferNonCitation);
    if (idx === -1) {
      break;
    }

    const para = working[idx];
    const overBudget = totalLength(working) - maxTotalChars;
    const targetLength = Math.max(MIN_PARAGRAPH_LENGTH, para.text.length - overBudget);
    const nextLength = Math.min(para.text.length, targetLength);

    if (nextLength < para.text.length) {
      working[idx] = { ...para, text: trimParagraph(para.text, nextLength) };
      continue;
    }

    // If we cannot meaningfully trim, drop the farthest paragraph.
    working.splice(idx, 1);
  }

  // Final guard in case trimming left us slightly over budget
  if (totalLength(working) > maxTotalChars && working.length > 0) {
    const idx = farthestParagraph(false);
    if (idx >= 0) {
      const para = working[idx];
      const remaining = maxTotalChars - (totalLength(working) - para.text.length);
      working[idx] = { ...para, text: trimParagraph(para.text, Math.max(1, remaining)) };
    }
  }

  return working;
}

export function selectContextWindow(
  paragraphs: string[],
  cursorIndex: number,
  options: ContextSelectionOptions
): SelectedParagraph[] {
  const radius = Math.max(0, options.radius);
  const maxTotalChars = options.maxTotalChars ?? 1600;
  const prioritizeCitations = options.prioritizeCitations ?? true;

  const start = Math.max(0, cursorIndex - radius);
  const end = Math.min(paragraphs.length - 1, cursorIndex + radius);

  const candidates: SelectedParagraph[] = [];
  for (let i = start; i <= end; i++) {
    const text = paragraphs[i];
    candidates.push({
      index: i,
      text,
      hasCitation: containsCitation(text)
    });
  }

  const citationCandidates = candidates.filter((p) => p.hasCitation);
  const nonCitationCandidates = candidates.filter((p) => !p.hasCitation);

  const sortByDistance = (a: SelectedParagraph, b: SelectedParagraph): number => {
    return distanceFromCursor(a.index, cursorIndex) - distanceFromCursor(b.index, cursorIndex);
  };

  let ordered: SelectedParagraph[];
  if (prioritizeCitations) {
    ordered = [...citationCandidates.sort(sortByDistance), ...nonCitationCandidates.sort(sortByDistance)];
  } else {
    ordered = [...candidates].sort(sortByDistance);
  }

  const uniqueByIndex = new Map<number, SelectedParagraph>();
  for (const para of ordered) {
    uniqueByIndex.set(para.index, para);
  }

  const selection = Array.from(uniqueByIndex.values()).sort((a, b) => a.index - b.index);
  const constrained = enforceBudget(selection, cursorIndex, maxTotalChars);

  return constrained.sort((a, b) => a.index - b.index);
}
