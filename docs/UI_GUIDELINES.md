# UI 一貫性ガイドライン（全画面共通）

このプロジェクトの全画面が従う唯一のデザイン規約。すべての画面・コンポーネントはこれに揃える。

## 絶対ルール：色は変更しない
- 新しい hex / rgb() / hsl() / 新しい Tailwind カラーファミリー（既存ファイルに無い `bg-*` `text-*` `border-*` 色）を**追加しない**。
- テーマトークン・`primaryColor`・CSS変数を変更しない。
- 編集対象ファイルに**既に存在する**カラークラスのみ再利用してよい。
- 「磨く」とは：余白・パディング・gap・角丸・タイポgrafィ（サイズ/太さ/行間/字間）・整列・空状態・ローディング・タップ領域・レスポンシブ（モバイル優先）・固定ヘッダー・控えめなトランジション。**色ではない。**

## 1. ページの骨格
```
<div className="flex flex-col h-full overflow-hidden">
  {/* ヘッダー（固定） */}
  <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
    <h1 className="text-xl font-bold tracking-tight">タイトル</h1>
    <p className="text-sm text-muted-foreground mt-0.5">1行の説明（任意）</p>
  </div>
  {/* 本文（スクロール） */}
  <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 md:space-y-6">
    ...
  </div>
</div>
```
- ページタイトルは必ず `text-xl font-bold tracking-tight`。`text-2xl` 等のバラつきは禁止、ここに統一。
- ヘッダーは `border-b border-border bg-background` で、スクロールしても上に残るなら `shrink-0`。

## 2. 余白・リズム
- 本文パディング：`p-4 md:p-6`
- 縦のリズム：`space-y-5` または `space-y-6`
- カード内：`p-4`（密なら `p-3`）

## 3. カード / セクション
- 既存の `<Card>` を使う。セクション見出しは `text-sm font-semibold` か `text-base`。
- 角丸は `rounded-lg` / `rounded-xl` に統一（`rounded-md` の乱用を避ける）。

## 4. 空状態（必ずこの形）
```
<div className="text-center py-10 text-muted-foreground">
  <Icon className="h-9 w-9 mx-auto mb-2 opacity-25" />
  <p className="text-sm">〜はありません</p>
</div>
```

## 5. ローディング
- リスト/グリッドが来る場所は spinner ではなく `<Skeleton>` を**実際のコンテンツ形状に似せて**並べる。
- 全画面の公開ページ（ログイン等）では中央 spinner で可。

## 6. タイポグラフィ階層
- 主要数値：`text-2xl md:text-3xl font-bold tabular-nums leading-none`
- 行内の主テキスト：`text-sm font-medium`、副次：`text-xs text-muted-foreground`
- 長文：`leading-relaxed`

## 7. ボタン / 操作
- 既存の variant・色はそのまま。サイズ/余白/整列だけ整える。
- モバイルの主要アクションは縦 **40px 以上**（`h-10` 以上）。アイコンボタンも小さすぎないこと（モバイル `h-10 w-10`、`sm+` で `h-9 w-9` 等）。
- アイコンは原則 `h-4 w-4`（小さな補助は `h-3.5 w-3.5`）。
- 押下フィードバック：`active:scale-95` か `active:bg-accent/50` を主要操作に。

## 8. フォーム入力
- 主要入力は `h-10`（公開ページの主役入力は `h-12`〜`h-14`）。
- ラベルは `text-sm`、`mb-1.5 block`。

## 9. レスポンシブ
- モバイル優先。横並びは狭い幅で折り返す（`flex-wrap` / グリッドの段数を `sm:` `md:` `lg:` で調整）。
- テキストの折り返し崩れ（例：「本日の予/約」）を避ける：`leading-tight`、必要なら `text-xs md:text-sm`、`min-w-0 truncate`。
- 横スクロールが必要な表/タイムラインは `overflow-x-auto` でラップし、行は潰さない。

## 10. 変えてはいけないもの
- 機能・props・query key・mutation・ロジック・閾値・**`data-testid`**。
- これらは一切削除/改名しない。**見た目とレイアウトだけ**を変える。

## 11. ビルド
- 変更後は `npm run build` を通すこと。TS/JSX エラーは自分の変更が原因なら必ず直す。
