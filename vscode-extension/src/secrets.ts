import * as vscode from 'vscode';

export class SecretsManager {
  constructor(private readonly storage: vscode.SecretStorage) {}

  async saveApiKey(providerId: string, apiKey: string): Promise<void> {
    await this.storage.store(this.getProviderKey(providerId, 'apiKey'), apiKey);
  }

  async getApiKey(providerId: string): Promise<string | undefined> {
    return this.storage.get(this.getProviderKey(providerId, 'apiKey'));
  }

  async deleteApiKey(providerId: string): Promise<void> {
    await this.storage.delete(this.getProviderKey(providerId, 'apiKey'));
  }

  async savePlusToken(providerId: string, token: string): Promise<void> {
    await this.storage.store(this.getProviderKey(providerId, 'plusToken'), token);
  }

  async getPlusToken(providerId: string): Promise<string | undefined> {
    return this.storage.get(this.getProviderKey(providerId, 'plusToken'));
  }

  async deletePlusToken(providerId: string): Promise<void> {
    await this.storage.delete(this.getProviderKey(providerId, 'plusToken'));
  }

  private getProviderKey(providerId: string, keyType: 'apiKey' | 'plusToken'): string {
    return `studyProgramming.provider.${providerId}.${keyType}`;
  }
}
