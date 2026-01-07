import { postprocessResponse } from '../../src/llm/postprocess';

describe('postprocessResponse', () => {
  it('preserves citations, math, and code fences while cleaning markdown', () => {
    const input = [
      'Intro with citation 【doc-1】.',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      '$$',
      'E = mc^2',
      '$$',
      '',
      'Inline math $a + b$ stays.',
      '',
      '',
      'Trailing spaces here.   '
    ].join('\n');

    const output = postprocessResponse(input);
    expect(output).toMatchSnapshot();
  });
});
