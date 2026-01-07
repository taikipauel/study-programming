# AI Writing Assistant 利用ガイド

## セットアップ
1. `vscode-extension` ディレクトリで依存関係をインストールします。
   ```bash
   npm install
   ```

## 前提条件
- Node.js: LTS 版（推奨、例: v18 以上）
- Visual Studio Code

## 開発・デバッグ
- `vscode-extension` を VS Code で開き、`F5` を押して Extension Host を起動します。
- 起動後はコマンドパレットから `Study Programming:` で始まるコマンドを実行してください。
- こちらは開発向けの起動方法です。配布目的の場合は次の「VSIX 生成」を使用します。

## VSIX 生成
- 配布向けの手順です。開発用途では「開発・デバッグ」での Extension Host 起動を使用してください。
1. `vscode-extension` ディレクトリで VSIX を生成します。
   ```bash
   npm run package
   ```
