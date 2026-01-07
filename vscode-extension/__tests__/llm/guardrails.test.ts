import { runGuardrails } from '../../src/guardrails/checks';

describe('runGuardrails', () => {
  it('reports missing citations', () => {
    const original = 'Answer with citation 【doc-1】.';
    const processed = 'Answer with citation.';

    const issues = runGuardrails(original, processed);
    expect(issues.map((issue) => issue.type)).toContain('citation-mismatch');
  });

  it('reports modified math segments', () => {
    const original = 'Equation $$E = mc^2$$.';
    const processed = 'Equation $$E = mc^3$$.';

    const issues = runGuardrails(original, processed);
    expect(issues.map((issue) => issue.type)).toContain('math-mismatch');
  });

  it('reports modified code fences', () => {
    const original = ['```js', 'console.log("a");', '```'].join('\n');
    const processed = ['```js', 'console.log("b");', '```'].join('\n');

    const issues = runGuardrails(original, processed);
    expect(issues.map((issue) => issue.type)).toContain('code-fence-mismatch');
  });
});
