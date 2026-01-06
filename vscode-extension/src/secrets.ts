import * as vscode from 'vscode';

export class SecretsManager {
  constructor(private readonly storage: vscode.SecretStorage) {}

  async saveApiKey(providerId: string, apiKey: string): Promise<void> {
    await this.storage.store(this.getProviderKey(providerId), apiKey);
  }

  async getApiKey(providerId: string): Promise<string | undefined> {
    return this.storage.get(this.getProviderKey(providerId));
  }

  async deleteApiKey(providerId: string): Promise<void> {
    await this.storage.delete(this.getProviderKey(providerId));
  }

  private getProviderKey(providerId: string): string {
    return `studyProgramming.provider.${providerId}.apiKey`;
  }
}
