import * as vscode from 'vscode';
import { applyMinimalEdits } from './applyEdits';
import { pickModel } from './modelPicker';
import { HistoryViewProvider } from './ui/historyView';
import { StatusBarController } from './ui/statusBar';

type Operation =
  | 'rewrite'
  | 'clarify'
  | 'summarize'
  | 'explain'
  | 'terms-harmonize'
  | 'citation-safe-rewrite';

type ExtensionSettings = {
  provider: string;
  model: string;
  tokenLimit: number;
  costCapUSD: number;
  streaming: boolean;
  telemetry: boolean;
};

type OperationRequest = {
  text: string;
  tone?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  maxSentences?: number;
};

const OPERATION_LABELS: Record<Operation, string> = {
  rewrite: 'Rewrite',
  clarify: 'Clarify',
  summarize: 'Summarize',
  explain: 'Explain',
  'terms-harmonize': 'Harmonize Terms',
  'citation-safe-rewrite': 'Citation-safe Rewrite'
};

const OUTPUT_CHANNEL = vscode.window.createOutputChannel('Study Programming');

const chunkText = (text: string): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [text];
  }
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 4) {
    chunks.push(words.slice(i, i + 4).join(' '));
  }
  return chunks;
};

const getSettings = (): ExtensionSettings => {
  const config = vscode.workspace.getConfiguration('studyProgramming');
  return {
    provider: config.get<string>('provider', 'openai'),
    model: config.get<string>('model', 'gpt-4o-mini'),
    tokenLimit: config.get<number>('tokenLimit', 4096),
    costCapUSD: config.get<number>('costCapUSD', 20),
    streaming: config.get<boolean>('streaming', true),
    telemetry: config.get<boolean>('telemetry', false)
  };
};

const generateOutput = (operation: Operation, request: OperationRequest): string => {
  switch (operation) {
    case 'rewrite':
      return `Rewritten${request.tone ? ` (${request.tone})` : ''}: ${request.text}`;
    case 'clarify':
      return `Clarified: ${request.text}`;
    case 'summarize': {
      const sentences = request.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      const maxSentences = request.maxSentences ?? 2;
      return `Summary: ${sentences.slice(0, maxSentences).join(' ') || request.text}`;
    }
    case 'explain':
      return `Explanation${request.level ? ` (${request.level})` : ''}: ${request.text}`;
    case 'terms-harmonize':
      return `Harmonized terms: ${request.text}`;
    case 'citation-safe-rewrite':
      return `Citation-safe rewrite: ${request.text}`;
  }
};

const streamToChannel = async (operation: Operation, text: string) => {
  OUTPUT_CHANNEL.show(true);
  OUTPUT_CHANNEL.appendLine(`\n${OPERATION_LABELS[operation]} (streaming):`);
  for (const chunk of chunkText(text)) {
    OUTPUT_CHANNEL.append(`${chunk} `);
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
  OUTPUT_CHANNEL.appendLine('\n');
};

const applyOutput = async (
  editor: vscode.TextEditor,
  range: vscode.Range,
  output: string
) => {
  const result = await applyMinimalEdits(editor, range, output);
  if (!result.applied) {
    OUTPUT_CHANNEL.appendLine(`Apply edits skipped: ${result.reason ?? 'unknown reason'}`);
  }
};

const buildOperationRequest = async (operation: Operation, text: string): Promise<OperationRequest> => {
  if (operation === 'explain') {
    const level = await vscode.window.showQuickPick(
      [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' }
      ],
      { title: 'Explain level', placeHolder: 'Choose explanation depth' }
    );
    return { text, level: level?.value };
  }

  if (operation === 'summarize') {
    const maxSentences = await vscode.window.showInputBox({
      title: 'Summarize',
      prompt: 'Max sentences (1-10)',
      value: '2',
      validateInput: (value) => {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
          return 'Enter an integer between 1 and 10.';
        }
        return undefined;
      }
    });
    return { text, maxSentences: maxSentences ? Number(maxSentences) : undefined };
  }

  if (operation === 'rewrite') {
    const tone = await vscode.window.showInputBox({
      title: 'Rewrite tone',
      prompt: 'Optional tone (e.g. formal, friendly)',
      placeHolder: 'formal'
    });
    return { text, tone: tone?.trim() || undefined };
  }

  return { text };
};

const runOperation = async (
  operation: Operation,
  history: HistoryViewProvider,
  statusBar: StatusBarController
) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Open a file to run this command.');
    return;
  }

  const selection = editor.selection;
  const range = selection.isEmpty
    ? new vscode.Range(
        0,
        0,
        editor.document.lineCount - 1,
        editor.document.lineAt(editor.document.lineCount - 1).range.end.character
      )
    : new vscode.Range(selection.start, selection.end);
  const selectedText = editor.document.getText(range).trim();

  if (!selectedText) {
    void vscode.window.showWarningMessage('Select some text to run this command.');
    return;
  }

  const settings = getSettings();
  statusBar.update(settings);

  const request = await buildOperationRequest(operation, selectedText);
  const output = generateOutput(operation, request);

  if (settings.streaming) {
    await streamToChannel(operation, output);
  } else {
    OUTPUT_CHANNEL.show(true);
    OUTPUT_CHANNEL.appendLine(`\n${OPERATION_LABELS[operation]}:`);
    OUTPUT_CHANNEL.appendLine(output);
  }

  await applyOutput(editor, range, output);
  history.addEntry({
    operation,
    input: selectedText,
    output,
    model: settings.model
  });
};

export const activate = (context: vscode.ExtensionContext) => {
  const historyProvider = new HistoryViewProvider();
  const statusBar = new StatusBarController();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('studyProgramming.history', historyProvider),
    statusBar
  );

  const commands: Array<[Operation, string]> = [
    ['rewrite', 'studyProgramming.rewrite'],
    ['clarify', 'studyProgramming.clarify'],
    ['summarize', 'studyProgramming.summarize'],
    ['explain', 'studyProgramming.explain'],
    ['terms-harmonize', 'studyProgramming.termsHarmonize'],
    ['citation-safe-rewrite', 'studyProgramming.citationSafeRewrite']
  ];

  commands.forEach(([operation, commandId]) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () =>
        runOperation(operation, historyProvider, statusBar)
      )
    );
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('studyProgramming.pickModel', async () => {
      const selection = await pickModel();
      if (selection) {
        historyProvider.setModel(selection.model);
        statusBar.update(getSettings());
      }
    }),
    vscode.commands.registerCommand('studyProgramming.history.clear', () => {
      historyProvider.clear();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('studyProgramming')) {
        statusBar.update(getSettings());
      }
    })
  );

  statusBar.update(getSettings());
};

export const deactivate = () => {
  OUTPUT_CHANNEL.dispose();
};
