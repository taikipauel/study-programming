# Study Programming

Study Programming は、VS Code 上で文章の書き換えや要約を支援する拡張機能のサンプル実装です。

## リポジトリ構成

- `vscode-extension/`: VS Code 拡張本体
- `config/`: プロバイダー設定やポリシー関連の JSON
- `docs/ai-writing-assistant/usage.md`: セットアップ・設定・利用フローのガイド
- `scripts/package-extension.sh`: VSIX のビルドと検証スクリプト

## ドキュメント

- 利用方法: `docs/ai-writing-assistant/usage.md`
- 設定例: `config/providers.json`
- 変更履歴（日本語）: `CHANGELOG.md`

## VSIX ビルド

以下のスクリプトで VSIX を生成し、検証まで行えます。

```bash
./scripts/package-extension.sh
```
