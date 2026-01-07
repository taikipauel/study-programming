import { selectContextWindow } from '../../src/context/window';

const joinedLength = (paragraphs: { text: string }[]): number => {
  return paragraphs.reduce((length, para, index) => length + para.text.length + (index > 0 ? 2 : 0), 0);
};

describe('selectContextWindow', () => {
  it('prioritizes citation paragraphs around the cursor when constrained', () => {
    const paragraphs = [
      'Intro without citation.',
      'Background [2] with citation and details.',
      'Observation nearby without cite.',
      'Cursor paragraph content without citation.',
      'Result (Doe, 2021) with a second citation.',
      'Postscript without important info.'
    ];

    const selection = selectContextWindow(paragraphs, 3, { radius: 2, maxTotalChars: 120 });
    const indices = selection.map((p) => p.index);

    expect(indices).toContain(1);
    expect(indices).toContain(4);
    expect(selection.find((p) => p.index === 1)?.hasCitation).toBe(true);
    expect(selection.find((p) => p.index === 4)?.hasCitation).toBe(true);
    expect(indices).toContain(3);
  });

  it('trims long paragraphs to fit the maximum character budget', () => {
    const paragraphs = [
      'Intro '.repeat(30),
      'Cursor paragraph with extensive details '.repeat(15) + 'and still going.',
      'Trailing paragraph with citation [12] and descriptive follow-up '.repeat(10)
    ];

    const selection = selectContextWindow(paragraphs, 1, { radius: 1, maxTotalChars: 220 });
    const total = joinedLength(selection);

    expect(total).toBeLessThanOrEqual(220);
    const cursorParagraph = selection.find((p) => p.index === 1);
    expect(cursorParagraph?.text.endsWith('…')).toBe(true);
  });
});
