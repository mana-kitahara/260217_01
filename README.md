# Soft Study Notes

個人利用向けの「手書き + 表編集 + 文書作成」に対応した、学習向けWebノートアプリです。  
PC / iPad / スマホのレスポンシブ利用を想定しています。

## 技術スタック

- Next.js (App Router)
- React + TypeScript
- Fabric.js（手書き）
- TipTap（リッチテキスト）
- dnd-kit（ドラッグ並び替え）
- LocalStorage（自動保存）
- PWA（manifest + Service Worker）

## 実装済み機能

- ノート一覧 / ノート作成
- フォルダ / タグ / 検索
- ノートのドラッグ&ドロップ並び替え
- 手書き（ペン / 蛍光ペン / 消しゴム）
- ページの拡大・縮小
- 表編集（行列追加削除 / 結合分割 / コピー貼付 / ドラッグ移動 / サイズ変更）
- リッチテキスト（太字 / 見出し / 箇条書き / フォント変更）
- 文字数カウント
- 画像 / PDF の貼り付け（Ctrl/Cmd+V）
- 簡易クラウド同期（`/api/cloud` への保存・読込）

## カラーデザイン

- UI背景: `#FBE9FE`
- サイドバー: `#FFF4FF`
- ボタン: `#E5B6E8`
- ホバー: `#F3D4F6`
- 区切り線: `#EADBEF`
- ノート背景: `#FFFFFF`
- 罫線: `#EAEAEA`
- 文字色: `#4B454D`

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## ビルド確認

```bash
npm run build
```

## 補足

- 自動保存はブラウザの `localStorage` に保存されます。
- 簡易クラウド同期API（`/api/cloud`）はデモ用のインメモリ保存です。サーバー再起動で消えるため、本番利用時はDBや外部ストレージへの置換を推奨します。
