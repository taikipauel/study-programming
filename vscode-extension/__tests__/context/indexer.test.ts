import { chunkDocument, Chunk } from '../../src/context/indexer';

function chunkTypes(chunks: Chunk[]): string[] {
  return chunks.map((chunk) => chunk.type);
}

describe('chunkDocument', () => {
  it('identifies headings, captions, and reference blocks as distinct chunks', () => {
    const content = `# Title

Paragraph one introduces the topic.

Figure 1: Caption text for the diagram.

## Section

Paragraph two continues the discussion.

### References

[1] Author A. Title of paper.

[2] Author B. Another reference.`;

    const chunks = chunkDocument(content);

    expect(chunkTypes(chunks)).toEqual([
      'heading',
      'paragraph',
      'caption',
      'heading',
      'paragraph',
      'heading',
      'reference'
    ]);

    const caption = chunks.find((chunk) => chunk.type === 'caption');
    expect(caption?.text).toBe('Figure 1: Caption text for the diagram.');

    const referenceChunk = chunks.find((chunk) => chunk.type === 'reference');
    expect(referenceChunk?.text).toContain('[1] Author A. Title of paper.');
    expect(referenceChunk?.text).toContain('[2] Author B. Another reference.');

    const referenceHeadingIndex = chunks.findIndex(
      (chunk) => chunk.type === 'heading' && /references/i.test(chunk.text)
    );
    expect(referenceHeadingIndex).toBe(5);
  });
});
