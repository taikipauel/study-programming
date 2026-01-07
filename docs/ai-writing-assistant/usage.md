# AI Writing Assistant (Study Programming) 利用ガイド

このドキュメントは、`vscode-extension` 配下の Study Programming 拡張を使って、文章の書き換え・要約・説明などを行うためのセットアップ、設定、ワークフローをまとめたものです。

## セットアップ

1. 依存関係をインストールします。

   ```bash
   cd vscode-extension
   npm install
   ```

2. TypeScript をビルドして拡張の成果物を生成します。

   ```bash
   npx tsc -p tsconfig.json
   ```

3. VSIX を生成して VS Code に取り込みます。

   ```bash
   npx @vscode/vsce package --out dist/study-programming.vsix
   code --install-extension dist/study-programming.vsix
   ```

> メモ: VSIX を生成・検証するためのスクリプトは `scripts/package-extension.sh` を用意しています。

## 設定

拡張の設定は VS Code の設定 (`settings.json`) で管理します。主なキーは以下のとおりです。

- `studyProgramming.provider`: 利用するプロバイダー (`openai`, `anthropic`, `custom`)
- `studyProgramming.model`: 既定のモデル ID
- `studyProgramming.tokenLimit`: 1 回のリクエストで使う最大トークン数
- `studyProgramming.costCapUSD`: 予算の目安 (USD)
- `studyProgramming.streaming`: 出力をストリーミング表示するかどうか
- `studyProgramming.telemetry`: 匿名テレメトリの有効/無効
- `studyProgramming.loggingLevel`: ログレベル (`off`, `error`, `warn`, `info`, `debug`)
- `studyProgramming.logIncludeResponseBody`: ログにレスポンス本文を含めるか
- `studyProgramming.logRedactPii`: ログ内の個人情報をマスクするか

プロバイダーとモデルの対応は `config/providers.json` を参考にしてください。独自モデルを使う場合は `custom` を選択し、同ファイルにエントリを追加します。

## ワークフロー

1. 文章を編集し、対象のテキストを選択します。
2. コマンドパレット (`Cmd/Ctrl+Shift+P`) で次のコマンドを実行します。

   - **Study Programming: Rewrite Selection**
   - **Study Programming: Clarify Selection**
   - **Study Programming: Summarize Selection**
   - **Study Programming: Explain Selection**
   - **Study Programming: Harmonize Terms**
   - **Study Programming: Citation-safe Rewrite**

3. 結果は選択範囲に反映され、出力チャンネルにログが残ります。
4. **Study Programming History** ビューで履歴を確認できます。必要に応じて **Study Programming: Pick Model** でモデルを切り替えたり、**Study Programming: Clear History** で履歴を消去できます。

> 参考: 現状の拡張はワークフローと UI をデモするための実装であり、実際の API 呼び出しは行いません。プロバイダー設定を差し替えることで将来的な連携を見据えた構成になっています。
