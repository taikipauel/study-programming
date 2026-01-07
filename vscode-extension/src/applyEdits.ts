import * as vscode from 'vscode';

type MinimalEdit = {
  start: number;
  end: number;
  text: string;
};

type ApplyResult = {
  applied: boolean;
  reason?: string;
};

const countMatches = (text: string, pattern: RegExp): number => {
  return Array.from(text.matchAll(pattern)).length;
};

const hasBalancedMarkdownBlocks = (original: string, updated: string): boolean => {
  const originalFences = countMatches(original, /```/g);
  const updatedFences = countMatches(updated, /```/g);
  if (originalFences !== updatedFences) {
    return false;
  }

  const originalInline = countMatches(original, /`/g);
  const updatedInline = countMatches(updated, /`/g);
  if (originalInline !== updatedInline) {
    return false;
  }

  return true;
};

const computeMinimalEdit = (original: string, updated: string): MinimalEdit | null => {
  if (original === updated) {
    return null;
  }

  const minLength = Math.min(original.length, updated.length);
  let start = 0;
  while (start < minLength && original[start] === updated[start]) {
    start += 1;
  }

  let endOriginal = original.length;
  let endUpdated = updated.length;
  while (endOriginal > start && endUpdated > start) {
    if (original[endOriginal - 1] !== updated[endUpdated - 1]) {
      break;
    }
    endOriginal -= 1;
    endUpdated -= 1;
  }

  return {
    start,
    end: endOriginal,
    text: updated.slice(start, endUpdated)
  };
};

export const applyMinimalEdits = async (
  editor: vscode.TextEditor,
  range: vscode.Range,
  updatedText: string
): Promise<ApplyResult> => {
  const document = editor.document;
  const originalText = document.getText(range);

  if (originalText === updatedText) {
    return { applied: false, reason: 'No changes detected.' };
  }

  const isMarkdown = document.languageId === 'markdown';
  if (isMarkdown && !hasBalancedMarkdownBlocks(originalText, updatedText)) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, updatedText);
    await vscode.workspace.applyEdit(edit);
    return { applied: true, reason: 'Replaced full markdown range due to AST mismatch.' };
  }

  const minimalEdit = computeMinimalEdit(originalText, updatedText);
  if (!minimalEdit) {
    return { applied: false, reason: 'No minimal edit produced.' };
  }

  const baseOffset = document.offsetAt(range.start);
  const editRange = new vscode.Range(
    document.positionAt(baseOffset + minimalEdit.start),
    document.positionAt(baseOffset + minimalEdit.end)
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, editRange, minimalEdit.text);
  await vscode.workspace.applyEdit(edit);

  return { applied: true };
};
