export type ChunkType = 'heading' | 'paragraph' | 'caption' | 'reference';

export interface Chunk {
  type: ChunkType;
  text: string;
  start: number;
  end: number;
}

const paragraphRegex = /([^\r\n][\s\S]*?(?=(?:\r?\n\r?\n+)|$))/g;

const referenceHeadingRegex = /^(references|参考文献)\s*$/i;
const captionRegex = /^(figure|fig\.|図|表)\s*\d+[:.\-]/i;

function isHeading(text: string): boolean {
  return /^#{1,6}\s*\S/.test(text.trim());
}

function isReferenceHeading(text: string): boolean {
  const normalized = text.trim().replace(/^#{1,6}\s*/, '').trim();
  return referenceHeadingRegex.test(normalized);
}

function isCaption(text: string): boolean {
  return captionRegex.test(text.trim());
}

interface Paragraph {
  text: string;
  start: number;
  end: number;
}

function parseParagraphs(content: string): Paragraph[] {
  const matches = content.matchAll(paragraphRegex);
  const paragraphs: Paragraph[] = [];

  for (const match of matches) {
    if (!match[1]) {
      continue;
    }
    const text = match[1];
    const start = match.index ?? 0;
    const end = start + text.length;
    paragraphs.push({ text, start, end });
  }

  return paragraphs;
}

export function chunkDocument(content: string): Chunk[] {
  const paragraphs = parseParagraphs(content);
  const chunks: Chunk[] = [];

  let collectingReferences = false;
  let referenceStart = -1;
  let referenceEnd = -1;
  const referenceTexts: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.text.trim();

    if (collectingReferences) {
      if (referenceStart === -1) {
        referenceStart = paragraph.start;
      }
      referenceTexts.push(trimmed);
      referenceEnd = paragraph.end;
      continue;
    }

    if (isHeading(trimmed)) {
      chunks.push({
        type: 'heading',
        text: trimmed,
        start: paragraph.start,
        end: paragraph.end
      });

      if (isReferenceHeading(trimmed)) {
        collectingReferences = true;
      }
      continue;
    }

    if (isCaption(trimmed)) {
      chunks.push({
        type: 'caption',
        text: trimmed,
        start: paragraph.start,
        end: paragraph.end
      });
      continue;
    }

    chunks.push({
      type: 'paragraph',
      text: trimmed,
      start: paragraph.start,
      end: paragraph.end
    });
  }

  if (collectingReferences && referenceTexts.length > 0) {
    chunks.push({
      type: 'reference',
      text: referenceTexts.join('\n\n'),
      start: referenceStart,
      end: referenceEnd
    });
  }

  return chunks;
}
