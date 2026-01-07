import * as vscode from 'vscode';

export type ModelDefinition = {
  id: string;
  maxTokens: number;
  costPer1kTokensUSD?: number;
};

export type ProviderDefinition = {
  id: string;
  displayName: string;
  models: ModelDefinition[];
};

export type ModelCatalog = {
  providers: ProviderDefinition[];
};

export type ModelSelection = {
  provider: string;
  model: string;
};

const loadModelCatalog = async (): Promise<ModelCatalog | null> => {
  const candidates = await vscode.workspace.findFiles('config/providers.json', '**/node_modules/**', 1);
  const configUri = candidates[0];
  if (!configUri) {
    return null;
  }

  const raw = await vscode.workspace.fs.readFile(configUri);
  const parsed = JSON.parse(raw.toString('utf8')) as ModelCatalog;
  if (!parsed.providers || !Array.isArray(parsed.providers)) {
    throw new Error('Invalid providers.json format');
  }

  return parsed;
};

const formatModelDetail = (model: ModelDefinition): string => {
  const cost = model.costPer1kTokensUSD ? `$${model.costPer1kTokensUSD.toFixed(3)}/1k` : 'cost N/A';
  return `Max tokens: ${model.maxTokens} • ${cost}`;
};

export const pickModel = async (): Promise<ModelSelection | null> => {
  try {
    const catalog = await loadModelCatalog();
    if (!catalog) {
      void vscode.window.showWarningMessage(
        'No model catalog found. Ensure config/providers.json exists in your workspace.'
      );
      return null;
    }

    const providerPick = await vscode.window.showQuickPick(
      catalog.providers.map((provider) => ({
        label: provider.displayName,
        description: provider.id,
        provider
      })),
      { title: 'Select provider' }
    );

    if (!providerPick) {
      return null;
    }

    const modelPick = await vscode.window.showQuickPick(
      providerPick.provider.models.map((model) => ({
        label: model.id,
        detail: formatModelDetail(model),
        model
      })),
      { title: `Select model (${providerPick.provider.displayName})` }
    );

    if (!modelPick) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('studyProgramming');
    await config.update('provider', providerPick.provider.id, vscode.ConfigurationTarget.Global);
    await config.update('model', modelPick.model.id, vscode.ConfigurationTarget.Global);

    return {
      provider: providerPick.provider.id,
      model: modelPick.model.id
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load models.';
    void vscode.window.showErrorMessage(message);
    return null;
  }
};
