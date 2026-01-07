import * as vscode from 'vscode';

export type HistoryEntry = {
  operation: string;
  input: string;
  output: string;
  model: string;
  timestamp?: number;
};

class HistoryItem extends vscode.TreeItem {
  constructor(readonly entry: HistoryEntry) {
    super(`${entry.operation}: ${entry.input.slice(0, 40)}`, vscode.TreeItemCollapsibleState.None);
    this.description = `${entry.model} • ${new Date(entry.timestamp ?? Date.now()).toLocaleTimeString()}`;
    this.tooltip = `${entry.output}`;
  }
}

export class HistoryViewProvider implements vscode.TreeDataProvider<HistoryItem> {
  private readonly entries: HistoryEntry[] = [];
  private model = 'gpt-4o-mini';
  private readonly emitter = new vscode.EventEmitter<HistoryItem | null>();

  readonly onDidChangeTreeData = this.emitter.event;

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HistoryItem[] {
    return this.entries.map((entry) => new HistoryItem(entry));
  }

  addEntry(entry: HistoryEntry) {
    const model = entry.model || this.model;
    this.entries.unshift({ ...entry, model, timestamp: Date.now() });
    this.emitter.fire(null);
  }

  setModel(model: string) {
    this.model = model;
  }

  clear() {
    this.entries.splice(0, this.entries.length);
    this.emitter.fire(null);
  }
}
