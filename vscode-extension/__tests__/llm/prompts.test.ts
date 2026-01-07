import { resolvePromptTemplate } from '../../src/llm/prompts';

describe('resolvePromptTemplate', () => {
  it('returns the local template for local provider', () => {
    const template = resolvePromptTemplate({ provider: 'local' });
    expect(template.variant).toBe('local');
    expect(template.system).toContain('local model');
  });

  it('returns the plus template when plus is enabled', () => {
    const template = resolvePromptTemplate({ provider: 'openai', hasPlus: true });
    expect(template.variant).toBe('plus');
    expect(template.system).toContain('ChatGPT Plus');
  });

  it('returns the provider template when plus is disabled', () => {
    const template = resolvePromptTemplate({ provider: 'azure', hasPlus: false });
    expect(template.variant).toBe('provider');
    expect(template.system).toContain('AI assistant');
  });
});
