import * as assert from 'assert';
import * as vscode from 'vscode';

export const run = async () => {
  const extension = vscode.extensions.getExtension('study-programming.study-programming-extension');
  assert.ok(extension, 'Extension should be available');
  await extension?.activate();

  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('studyProgramming.rewrite'), 'Rewrite command should be registered');
};
