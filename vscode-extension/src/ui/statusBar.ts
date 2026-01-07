import * as vscode from 'vscode';

export type StatusSettings = {
  provider: string;
  model: string;
  streaming: boolean;
};

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'studyProgramming.pickModel';
    this.item.tooltip = 'Select Study Programming model';
    this.item.show();
  }

  update(settings: StatusSettings) {
    const streamIcon = settings.streaming ? '$(sync~spin)' : '$(circle-slash)';
    this.item.text = `${streamIcon} ${settings.provider}/${settings.model}`;
  }

  dispose() {
    this.item.dispose();
  }
}
