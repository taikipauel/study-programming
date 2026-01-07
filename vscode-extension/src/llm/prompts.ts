import { ProviderType } from './client';

export type PromptTemplateVariant = 'plus' | 'provider' | 'local';

export interface PromptTemplate {
  variant: PromptTemplateVariant;
  system: string;
  user: string;
}

const PLUS_TEMPLATE: PromptTemplate = {
  variant: 'plus',
  system: 'You are ChatGPT Plus. Follow the user instructions carefully and cite sources.',
  user: 'User request:\n{{input}}\n\nProvide a concise, well-structured response.'
};

const PROVIDER_TEMPLATE: PromptTemplate = {
  variant: 'provider',
  system: 'You are an AI assistant. Follow instructions and provide citations when asked.',
  user: 'User request:\n{{input}}\n\nAnswer with clear headings and bullet points as needed.'
};

const LOCAL_TEMPLATE: PromptTemplate = {
  variant: 'local',
  system: 'You are a local model. Be precise, avoid speculation, and keep responses brief.',
  user: 'User request:\n{{input}}\n\nRespond with minimal formatting and no extra chatter.'
};

export interface PromptTemplateOptions {
  provider: ProviderType;
  hasPlus?: boolean;
}

export function resolvePromptTemplate(options: PromptTemplateOptions): PromptTemplate {
  if (options.provider === 'local') {
    return { ...LOCAL_TEMPLATE };
  }

  if (options.hasPlus) {
    return { ...PLUS_TEMPLATE };
  }

  return { ...PROVIDER_TEMPLATE };
}
