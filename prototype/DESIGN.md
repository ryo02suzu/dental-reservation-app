# Arche UIプロトタイプ 制作ガイド

歯科医院の予約システム「Arche」のUIを、ゼロから作り直したプロトタイプです。
このファイルは、画面を作る人（人もエージェントも）が最初に読む共通ルールです。迷ったらここに戻ってください。

---

## 1. 何を作っているか

依頼主の言葉（そのまま）：

> 史上最高のUIの予約システム構築して！ … めっちゃ使いやすくて、しかも今の時代に合ってるような感じね！
> ただAI感は出さないでプロ中のプロが作ったようなものにして！ Appleとかそれくらい先進的な感じがいいな！
> UXは一旦作らなくていい！UIのみ！完璧なものにして！アニメーションやアクションは任せる！

- **UIのプロトタイプ**です。サーバーはなく、サンプルデータとメモリ上のストアで「本当に動いているように」見せます。
- 合格したら実アプリ（`client/src`）に移植します。まずデモ医院、その後に実際に使っている医院へ。
- 5つのアプリがあり、入口のランチャー（`#launcher`）から選びます。
  1. **医院スタッフ**（メイン。予約台帳・今日の受付・患者・お知らせ…）`#clinic`
  2. **患者さんのWeb予約**（医院のブランドで出る予約ページ）`#patient`
  3. **院内の受付端末**（待合のタブレットで患者さん自身が受付）`#kiosk`
  4. **運営コンソール**（Arche を提供している運営会社が契約医院を管理）`#console`
  5. **ログイン**（スタッフのサインイン）`#login`
- データはすべて架空です（医院は「ひだまり歯科クリニック」）。実在の医院名・人名は出しません。

## 2. 目指す見た目

お手本は **Apple純正アプリ**（iOS 18 / iPadOS / macOS の カレンダー・ヘルスケア・メール・設定・ウォレット・フィットネス）。
「Webのダッシュボードのテンプレート」ではなく、「Appleが歯科医院のために作ったアプリ」に見えることが目標です。

1. **内容が主役。** 枠・影・色ではなく、文字の大きさ・太さ・余白・グレーの階調で階層を作る。
2. **器の基本はインセットのグループ化リスト**（`ListSection` + `ListRow`）。カードは「そこだけ独立した物」として見せたいときに使う（例：診療中のユニット、患者さんの次回予約）。カードを敷き詰めない。
3. **色は控えめに。** 面はグレー（`bg`）と白（`surface`）、文字は `label`〜`label4`。アクセント（`sand` / `accent`＝砂色・焦げ茶）は1画面に数か所。**赤は「いま注意が必要なもの」だけ**（未来院・アレルギー・キャンセル・削除）。`tile-*` の補助色はアイコンタイル・アバター・グラフの系列・スタッフの色分けにだけ使う。
4. **余白は 4/8 の倍数。** スマホの左右は16px、PCは32px（`Page` が付ける）。行の高さはスマホ44px以上、PC 36〜44px。
5. **状態は色だけで伝えない。** 予約の状態は `StatusPill`（文字＋形）で示す。
6. **スマホとPCで同じアプリに見えること。** スマホ＝iPhoneアプリ（下にタブバー、画面は横から積み重なる）、PC＝Macアプリ（左にサイドバー、必要なら右にインスペクタ）。iPad幅（768〜1179px）でも崩れないこと。
7. **情報の密度。** 医院スタッフ向けは仕事道具なので、PCでは一画面にしっかり情報を載せる（それでも静かに見えるように）。患者さん向けはゆったり、迷わせない。

### 「AIっぽさ」を出さないための禁止事項

- グラデーションの文字、紫〜青のグラデーション、ネオン、光る影（glow）、すりガラスのカードの多用
- 絵文字（✨🦷📅 など）、意味のない装飾アイコン、見出しごとにアイコンを付けること
- 英字の小さな大文字ラベル（`OVERVIEW` `INSIGHTS` `TODAY'S SCHEDULE` など）。見出しは日本語で。
- 「AIのおすすめ」「スマートインサイト」のような、実在しない機能のパネル
- 01 / 02 / 03 のような番号飾り（本当に手順を示すとき以外）
- 全部中央揃え、全部カード、全部 `rounded-2xl shadow-lg`、カード左端の色帯（予約台帳のブロックだけは例外。カレンダーの慣習なので可）
- 宣伝文句（シームレス、スマート、革新的、次世代、かんたん○○、「〜しましょう！」の連発）
- ダミーの文字（lorem ipsum、テキストテキスト、同じ名前の繰り返し）
- ずっと動き続ける飾り（脈打つ点、回転、光の走査、紙吹雪、浮遊）。動きは「操作への反応」と「状態の変化」だけ。
- 読み込み中のスピナーやスケルトン（データはすぐ出せるので不要）

## 3. 言葉づかい

- UIはすべて日本語。英語は固有名詞・一般的な略語だけ（Web、LINE、QR、SMS、PMTC、SRP、CR）。
- **スタッフ向け**は簡潔に（「予約」「氏名」「受付する」）。**患者さん向け**（Web予約・受付端末）は丁寧に（「ご予約」「お名前」「受付が完了しました」）。
- ボタンは動詞で短く：「受付する」「診療を開始」「完了にする」「予約を登録」「キャンセルする」。
- 説明文は です・ます。短く、具体的に。結果を伝えるトーストは「予約を登録しました」のように事実を一文で。
- エラーは「何が起きたか＋どうすればよいか」（例：「電話番号は数字で入力してください」）。謝らない、ぼかさない。
- 数字は `tnum`。時刻は `hm()`（9:30）、日付は `md()` / `mdw()`（11月13日（金））、金額は `yen()`（¥3,300）。相対日は `relDay()` / `ago()`。
- 電話番号・メールアドレスは**リンクにしない**（公開先で動かない）。文字で出し、必要ならコピーボタンを付ける。

### 歯科の現場として正しく

- 用語：初診／再診、保険診療／自費診療、定期検診・クリーニング、PMTC、スケーリング、SRP（歯周病治療）、むし歯治療（CR充填・インレー）、根管治療、抜歯、被せ物（クラウン）・詰め物、入れ歯（義歯）、ホワイトニング、インプラント相談、矯正相談、小児歯科（フッ素塗布・シーラント）、問診票、オンライン資格確認（マイナ保険証を受付のカードリーダーで毎回読み取る。持っていない人は資格確認書を提示。紙の保険証は2025年12月で廃止）、会計、次回予約、リコール（3・4・6か月ごとの定期検診のご案内）、ユニット（診療台）、歯科医師（Dr）、歯科衛生士（DH）、歯科助手、受付。
- 歯の呼び方は「右下6番」（データでは `LR6`。`UR`=右上 `UL`=左上 `LR`=右下 `LL`=左下、患者さんから見た左右）。乳歯は A〜E。
- 歯式の記号（`ToothState`）：`C` むし歯／`CR` CR充填／`In` インレー／`Cr` クラウン／`RCT` 根管治療済み／`M` 欠損／`Imp` インプラント／`Br` ブリッジ／`観察` 要観察。
- 治療前に必ず目に入るべき注意事項：抗凝固薬（ワーファリン等）、BP製剤（骨粗しょう症の薬）、ペースメーカー、妊娠中、アレルギー（ラテックス、ペニシリン系、局所麻酔）。`alertsOf(p)` が返す。
- 医院の1日：午前 9:00〜13:00、昼休み、午後 14:30〜19:00（土曜は 14:00〜17:00）。木曜・日曜・祝日は休診。ユニット1・2は歯科医師、ユニット3・4は歯科衛生士。
- 受付の流れ：予約 → 来院（受付）→ 待合 → 診療中 → 完了（会計・次回予約）。来ない人は「未来院」→ 連絡 → 無断キャンセル。Web予約は「仮予約（承認待ち）」で入ることがある。

## 4. 色・文字・形（トークン）

Tailwind のクラスは `prototype/tailwind.config.cjs` に定義したものだけを使います。

- **色**：`bg` `grouped` `surface` `surface2` `elevated` `thumb` `label` `label2` `label3` `label4` `sep` `fill` `accent` `sand` `onsand` `ink` `onink` `red` `material` `tile-{sand,graphite,slate,sage,clay,plum,ocean,amber}`。`white` / `black` は特別な場合だけ（赤や濃い面の上の文字など）。
  - 不透明度は `/4 /6 /8 /12 /14 /16 /18 /22 /24 /28 /32 /36 /45 /55 /65 /72 /78 /85 /92` と 10 刻み。例：`bg-fill/12`（iOSの塗り）、`text-label/60`。
  - **`dark:` は使わない。** トークンがライト／ダークを自動で切り替える。**16進・`rgb()` の直書きも禁止。** SVGでは `fill="rgb(var(--accent))"` や `className="text-accent"` + `currentColor` でトークンを参照する。
- **文字サイズ**（iOSのテキストスタイル）：`text-large`(34) `text-title1`(28) `text-title2`(22) `text-title3`(20) `text-headline`(17 semibold) `text-body`(17) `text-callout`(16) `text-subhead`(15) `text-footnote`(13) `text-caption`(12) `text-caption2`(11)。PCの本文は 14〜15px（`text-[14px]` / `text-subhead`）で良い。
  - `font-family` は指定しない（システムフォント：SF / ヒラギノ）。
  - 和文の見出しには `palt`（字詰め）。本文には付けない。数字が並ぶところは `tnum`。
  - 和文の本文の行間は 1.6〜1.75（`leading-[1.7]` など）。和文に `tracking-*` を広げない。
- **角丸**：`rounded-cell`(12) `rounded-card`(16) `rounded-sheet`(14)。ボタンの形は `Button` に任せる。
- **影**：`shadow-thumb` `shadow-float` `shadow-pop` だけ。基本は影なし。
- **罫線**：`hairline-b` `hairline-t` `hairline-l` `hairline-r` `hairline`（0.5pxの線）。太い `border` は使わない。
- **すりガラス**：`material` `material-thick`（固定バー・浮いている面だけ）。
- **斜線**：`hatch`（休診・昼休み・時間外）。
- その他：`no-scrollbar` `safe-b` `safe-t`。

## 5. 部品（`src/ui`）

使う前に、必ずそのファイルを開いて props を確認してください（どれも短いファイルです）。`import { … } from "@/ui"`。

| 部品 | 用途 |
|---|---|
| `Page` | すべての画面の土台。大見出し→スクロールで小見出しのバーに変わる。`title` `subtitle` `back` `actions` `accessory` `wide` `flush` `hideLargeTitle` |
| `ListSection` / `ListRow` / `IconTile` | iOSのグループ化リスト。行は `icon`+`tone` か `leading`（アバター等）、`title` `subtitle` `value` `trailing` `chevron` `onClick` `destructive` `selected` |
| `Button` / `IconButton` | `variant`: filled（黒/白）・sand・tinted・gray・plain・destructive・destructiveTinted、`size`: sm・md・lg、`icon`、`full` |
| `Segmented` | セグメントコントロール（選択の背景がなめらかに移動）。`count` で件数も出せる |
| `Sheet` | スマホは下から出るシート、PCは中央のダイアログ（`variant="inspector"` で右の詳細パネル。背景を暗くせず後ろも操作でき、別の予約を開くと中身が入れ替わる）。`confirmLabel` `onConfirm` `footer` `size` |
| `Tag` / `StatusPill` / `STATUS` / `CountBadge` | 小さなラベル、予約の状態（仮予約・予約・未来院・来院済・診療中・完了・キャンセル・無断キャンセル）、件数 |
| `Avatar` / `toneOf` | 頭文字のアバター（写真は使わない） |
| `SearchField` / `Switch` / `Stepper` / `FieldRow` | 入力部品 |
| `useToast` | `const toast = useToast(); toast("予約を登録しました", { detail: "11月20日（金）15:30", action: { label: "取り消す", onClick: undo } })`。PCは上、スマホはタブバーの上に出る。取り返しのつきにくい操作（完了・受付・無断キャンセル・解約など）には action で「取り消す」を付ける |
| `Sparkline` / `Bars` / `Ring` | 小さなグラフ |
| `Surface` / `Stat` / `EmptyState` | 面、数字の指標（`compareLabel` で「先週比」なども。1%未満の増減は色を付けない＝`quietBelow`）、空のときの表示 |
| `Menu` / `MenuItem` / `MenuSeparator` | ポップアップメニュー |
| `spring` `springSoft` `springBouncy` `springPush` `easeOut` `tap` `tapSoft` `listItem` | 動きの共通値 |
| `cn` | クラス名の結合 |

足りない部品は、**自分の担当フォルダの中に**作ってください（`src/ui` は編集しない）。見た目は既存の部品に揃えること。

## 6. データ・ストア・時刻

- **`@/data`**（型は `src/data/types.ts`）
  - 規模：患者さん800人、予約は「今週より前の12週」から35日先まで（約3,600件）。1人あたりの予約は4か月で最大9件ほど。しばらく来院していない患者さんがリコールの対象になる。
  - `clinic`（医院情報）、`HOURS` / `hoursFor(d)`（診療時間）、`clinicPhase(now)`（午前の診療中・昼休み などの時間帯）、`staff` `units` `services` `patients`、`ME`（患者アプリでログインしている本人：田中 美咲）
  - `patientById` `serviceById` `staffById` `unitById`
  - `visitsOf(p)`：**42日より前**の来院記録（`WINDOW_START` より前）。それ以降の来院はストアの予約（`completed`）から出す。
  - `availableStarts(day, minutes, appointments, role?)`：その日に予約できる開始時刻（30分刻み、空きユニットがある時刻）。`role`（`"Dr"` / `"DH"`）を渡すと、その職種のユニット（`UNITS_BY_ROLE`：歯科医師＝ユニット1・2、歯科衛生士＝3・4）だけで数える。予約を作るときは必ず職種に合うユニットに入れる
  - レポート用（すべて予約データからの集計）：`weekly`（先週までの12週。最後が先週）、`kpis`（直近30日とその前の30日）、`HEATMAP_DAYS` `HEATMAP_HOURS` `heatmap`（直近8週の稼働率）、`summarize(from, to)`（任意の期間の集計）、`WEEK_START`（今週の月曜）
  - スタッフ用：`shiftWeek` `attendanceToday`
  - 運営用：`PLANS` `addons` `consoleClinics` `consoleMonthly`
  - `initialAppointments` `recalls` `notices` `initialMemos` は**直接使わず、ストアから読む**。
- **`useStore()`**（`@/lib/store`）：`appointments` `recalls` `notices` `patients` `memos` と、変更用の
  `setStatus(id, status)` `addAppointment(a)` `updateAppointment(id, patch)` `removeAppointment(id)` `setRecall(patientId, status)`
  予約には受付端末の受付番号 `receiptNo` を持てる。
  `readNotice(id)` `readAllNotices()` `addNotice(n)` `addPatient(p)` `updatePatient(id, patch)` `addMemo(m)` `updateMemo(id, patch)` `removeMemo(id)`、
  いま使っているスタッフ `currentStaffId` と `setCurrentStaff(id)`（ログインで選んだ人。既定は受付の石井 真央）。
  - **画面をまたいで反映させたい変更は必ずストアで。** 例：受付端末で受付 → 医院の「今日」で来院済になる。患者さんがWeb予約 → 医院の「今日」「予約台帳」に仮予約が現れ、「お知らせ」に通知が届く。
  - 保存はしない（再読み込みで元に戻る）。
- **時刻**（`@/lib/clock`）：`TODAY` `TODAY_KEY`（"yyyy-MM-dd"）`now()` `useNow(ms)` `minutesOfDay(d)` `isClinicOpenDay(d)`。
  デモの「いま」は、今日（休診日なら次の診療日）の **10:42 から実時間で進む**。「いま」が必要なときは必ず `now()` / `useNow()` を使い、`new Date()` は使わない。祝日は `@/lib/holidays` の `getHolidayName`。
- **書式**（`@/lib/format`）：`key` `fromKey` `md` `mdw` `longDate` `wd` `hm` `hhmm` `toMin` `duration` `yen` `relDay` `ago` `age` `kanaRow` `KANA_ROWS` `WEEKDAYS`、
  検索用の `toKatakana` `matchesPatient(p, query)`（ひらがな・番号・電話でも当たる）、歯の `toothLabel("LR6")`→「右下6番」と `TOOTH_STATE_LABEL`。
- **医院アプリ用**：`@/apps/clinic/helpers`（`statusOf`＝未来院の判定込みの表示上の状態、`isActive` `expand` `useDay` `alertsOf` `riskOf` `LATE_GRACE`）と、予約1件の共通行 `ApptRow`（`@/apps/clinic/ApptRow`）。
- 自分のファイルの中で補助データを作るのは構わない。ただし**毎回同じ結果**になること（描画中に `Math.random()` を使わない。IDや番号から決める）、共有データと矛盾しないこと（同じ人・同じ予約）、現実にありそうな内容であること。
- 今日の予約IDや目立たせている患者を調べるには：`node prototype/tools/today.mjs`（日付を渡すとその日）。

## 7. 画面の場所（ルーティング）

- URLの `#` に「アプリ--画面--パラメータ--シート」の形で持つ。
  例：`#clinic`（今日）、`#clinic--patients--p015`、`#clinic--schedule----appt-a1206`（パラメータなしでシートだけ）、`#patient--book--time`、`#console--clinics`。
- `useRoute()`（`@/lib/nav`）：`route`（`app` `screen` `param` `sheet`）、`go(screen, param?, { replace?, sheet? })`、`goApp(app, screen?, param?)`、`setSheet(sheet?)`。`location.hash` を直接書かない。
- 画面のコンポーネントは `{ param?: string }` を受け取る。
- **医院アプリ**：`useClinicUI()`（`@/apps/clinic/context`）→ `openAppointment(id)` `openNew(prefill?)` `openSearch()` `go(screen, param?)` `back`（スマホで「その他」の下の画面のときだけ） `phone`。
  シートは `ClinicApp` が `#` から出す：`appt-<予約ID>` → 予約の詳細、`new` → 新規予約、`search` → 検索（⌘K）。
  スマホでは `param` が付くと1段深い画面として横から積み重なる。詳細画面には `Page` の `back` で戻るボタンを出す（`go(screen)` で一覧へ）。
- **患者アプリ**：画面は `home` `book` `mine`。予約の手順は `book` の `param`：`type` → `menu` → `time` → `info` → `confirm` → `done`。入力中の内容は `useDraft()`（`@/apps/patient/PatientApp`）。

## 8. レイアウト

- 幅：スマホ `< 768px`（`useIsPhone()`）、タブレット 768〜1179px、`≥ 1024px`（`useIsDesktop()`）、ワイド `≥ 1180px`（`useIsWide()`）、任意の幅は `useMinWidth(px)`。Tailwind の `md:`=768、`lg:`=1024、`xl:`=1280。
- **390×844（iPhone）、1024×768 または 820×1180（iPad）、1440×900（Mac）** で正しく見えること。ページ全体が横にスクロールしないこと（台帳や表のように横に長いものは、それ自身の `overflow-x-auto` の中で）。
- すべての画面の一番外は `<Page>`（例外：ログインと受付端末は全画面の専用レイアウト）。医院アプリでは、外側（サイドバー／タブバー、下の余白）はシェルが用意している。`Page` と競合するスクロール領域を外側に作らない。
- PCでは段組み（一覧＋詳細、本文＋右カラム）を積極的に使う。最大幅は 1080px（`wide` で解除）。一覧＋詳細の2段組みは `useIsDesktop()`（1024px以上）からにそろえる。
- スマホのタップ領域は 44px 以上。入力欄の文字は 16px 以上（iOSで拡大されないように）。
- 行の中の名前には `min-w-0` と `truncate`。長い名前・0件・大量の件数でも崩れないこと。
- 固定のバーは `safe-b` / `safe-t` で端末の余白を避ける。

## 9. 動き

- `framer-motion` と `@/ui/motion` の値だけを使う。
- 使いどころ：一覧の並び替え・追加・削除（`AnimatePresence` + `layout`）、選択の背景の移動（`layoutId`）、シートと画面の積み重ね（spring）、押せる面の押し込み（`whileTap={tap}` / `tapSoft`）、状態が変わった瞬間の短い強調。
- 速さは 0.2〜0.4 秒の感覚。跳ねさせるのは小さな完了の印（チェックマークなど）だけ（`springBouncy`）。
- 経過時間の表示（「6分待ち」）が進むのは良いが、飾りのためのループアニメーションは置かない。
- `MotionConfig reducedMotion="user"` は全体に設定済み。CSSのアニメーションには `motion-safe:` を付ける。

## 10. 公開先（Artifact）の制約

完成したら claude.ai の Artifact として公開します。そこでは次のものが**動きません**。

- `alert()` / `confirm()` / `prompt()`（何も起きない）→ 確認は画面の中で（シート、その場の確認ボタン）。
- `window.print()`、ファイルのダウンロード、`tel:` / `mailto:` / `sms:` のリンク、iframe、外部の画像・フォント・API。
- アイコンは `lucide-react` だけ。写真・画像は使わない（アバターは頭文字）。図が必要なら小さなインラインSVGをトークンの色で。
- `localStorage` に頼らない（使うなら try/catch で、なくても正しく動くこと）。
- クリップボード：クリックの処理の中で `navigator.clipboard.writeText()` を try/catch で呼び、成功したらトースト。
- キーボード：フォーカスが見えること（全体に設定済み）、Esc でシートが閉じること、PCは ⌘K で検索（設定済み）。

## 11. ファイルの担当

- **共有（編集禁止）**：`src/ui/**` `src/data/**` `src/lib/**` `src/main.tsx` `src/styles.css` `tailwind.config.cjs` `build.mjs` `page.html` `tools/**`
  `src/apps/clinic/{ClinicApp.tsx,context.tsx,helpers.ts,ApptRow.tsx}` `src/apps/clinic/screens/More.tsx`
  `src/apps/patient/PatientApp.tsx` `src/apps/console/ConsoleApp.tsx` `src/apps/launcher/**` `DESIGN.md`
- 画面を作る人は、**割り当てられたファイルだけ**を編集し、新しいファイルは**割り当てられたフォルダの中だけ**に作る。
  割り当てられた入口ファイルの export の名前と props は変えない（シェルが読み込んでいる）。
- 共有のものに変更が必要なときは、自分では変えずに手元で回避し、最後の報告に「共有部分への要望」として書く。
- 同じ時間に、ほかの人が別のファイルを編集しています。ビルドが**自分のものではないファイル**のエラーで失敗したら、30〜60秒待って再試行する。他人のファイルは決して直さない。

## 12. 確認のしかた

リポジトリの一番上（`/home/user/dental-reservation-app`）で：

```sh
node prototype/build.mjs --out <自分専用のフォルダ>                 # ビルド（1秒ほど）
npx tsc -p prototype --noEmit 2>&1 | grep <自分のファイルのパス>    # 型チェック（自分のファイルだけ見る）
node prototype/tools/shot.mjs --dist <自分専用のフォルダ> --hash "#clinic" --out <フォルダ>/today-phone.png
node prototype/tools/shot.mjs --dist <自分専用のフォルダ> --hash "#clinic" --w 1440 --h 900 --dark --out <フォルダ>/today-mac-dark.png
node prototype/tools/shot.mjs --dist <自分専用のフォルダ> --batch <jobs.json>   # まとめて撮る（速い）
node prototype/tools/today.mjs                                      # 今日の予約IDと患者ID
```

- `shot.mjs` のオプション：`--w` `--h`（既定 390×844）、`--dark`、`--full`（スクロール全体）、`--wait <ms>`（最初の待ち）、`--scroll <px>`、`--scale`（既定 1。自分の確認は 1 倍で十分。人に見せる最終の画像だけ 2）。
  操作は書いた順に実行：`--click "<セレクタ>"`、`--fill "<セレクタ>=><文字>"`、`--press <キー>`（例 `Enter` `Escape` `ArrowDown`）、`--hover "<セレクタ>"`、`--pause <ms>`。
  `--batch` の steps では座標の操作 `{"mouse":[x,y]}`（移動）`{"clickAt":[x,y]}`（クリック）も使える（台帳の空き枠など）。
  セレクタは Playwright の形（`text=受付する`、`[aria-label="閉じる"]`、`input[placeholder="検索"]` など）。横のはみ出しとコンソールのエラー・失敗した操作を報告する（あると終了コード 2）。
- `--batch` には `[{"hash":"#clinic","out":"…/a.png","w":1440,"h":900,"dark":true,"steps":[{"click":"text=…"},{"fill":["input","たなか"]},{"press":"Enter"},{"wait":300}]}]` の形のJSONファイルを渡す。
- 撮った画像は**必ず開いて見る**。揃い・余白のリズム・文字の切れ・ダークモード・空の状態・長い名前を確認する。
- このコンテナの和文フォントはヒラギノではないので、字形の美しさではなく、レイアウトと階層で判断する。補うために `font-family` を指定しないこと。
- 出力先は自分専用のフォルダにする（ほかの人のビルドを上書きしない）。

## 13. 完成の条件

- [ ] 割り当てられた画面と状態がすべてある。ボタンは必ず何かをする（画面の移動・シート・ストアの更新・トースト）
- [ ] 390 / 1024 / 1440 の幅、ライト／ダークで崩れない・はみ出さない
- [ ] 自分のファイルに型エラーがない。コンソールにエラーが出ない
- [ ] 色はトークンだけ。`dark:` も16進もない
- [ ] 日本語が自然で、歯科の現場として正しい
- [ ] ほかの画面と同じ作法（`Page`、`ListSection`、`Sheet`、`StatusPill`、`ApptRow`、トースト）
