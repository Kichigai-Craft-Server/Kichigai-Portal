# キチクラ 公式ポータル

茨城高専電気科OBによるMinecraftマルチサーバー「キチクラ（キチガイクラフト / Kichigai-Craft）」の公式ポータルサイトです。
旧「キチクラ 公式Notion」の内容を移植しています。GitHub Pages でそのまま公開できる静的サイトです（ビルド不要）。

## リポジトリ

- リポジトリ: https://github.com/Kichigai-Craft-Server/Kichigai-Portal
- 公開URL（GitHub Pages）: https://kichigai-craft-server.github.io/Kichigai-Portal/

サイトのファイルはリポジトリのルートに置きます。

```bash
git clone https://github.com/Kichigai-Craft-Server/Kichigai-Portal.git
cd Kichigai-Portal
# 編集後
git add .
git commit -m "Update portal"
git push origin main
```

### GitHub Pages の公開設定

リポジトリの **Settings → Pages** で、Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして保存します。
gh コマンドで設定する場合は次のとおりです。

```bash
gh api -X POST repos/Kichigai-Craft-Server/Kichigai-Portal/pages -f "source[branch]=main" -f "source[path]=/"
```

※ 組織が GitHub Free プランの場合、GitHub Pages を使えるのは **Public リポジトリのみ** です。Private のまま公開するには GitHub Team 以上のプランが必要です。

## ローカルで確認する

JSON を `fetch` で読み込むため、`index.html` を直接ダブルクリックでは表示できません。HTTPサーバー経由で開いてください。

```bash
python3 -m http.server 8000
```

→ http://localhost:8000/

## フォルダ構成

```
index.html            ページの外枠（ヘッダー・フッター）
favicon.ico           ファビコン
site.webmanifest      ホーム画面追加用の設定
.nojekyll             GitHub Pages の Jekyll 処理を無効化
assets/
  css/style.css       デザイン
  js/app.js           JSON を読み込んで描画するスクリプト
  icons/              ロゴ・各サイズのアイコン
  img/                ページで使う画像（WebP）
data/
  site.json           サイト名・トップの説明文・メニュー・セクション・フッター・UI文言
  pages.json          全ページの一覧（タイトル・親ページ・カード表示用の情報）
  pages/<id>.json     各ページの本文
```

## 文章を編集する

文章・構成はすべて `data/` 以下の JSON で管理しています。HTML や JS を触る必要はありません。

### ページを追加する

1. `data/pages.json` に1件追加する

   ```json
   {
     "id": "kr-route-map",
     "title": "路線図",
     "parent": "kr",
     "icon": "🚃",
     "summary": "KR全線の路線図"
   }
   ```

   | キー | 説明 |
   |---|---|
   | `id` | URL になる英数字の識別子（`#/p/<id>`） |
   | `title` | ページタイトル |
   | `parent` | 親ページの `id`（パンくずリストに使用）。トップ直下は `null` |
   | `section` | トップのどの枠に属するか（`news` / `seasons` / `orgs`） |
   | `icon` | タイトル上とリンク一覧に出る絵文字 |
   | `summary` | カード・リンク一覧に出る短い説明 |
   | `thumb` | カードのサムネイル画像。なければ `mark` と `color` のタイルを表示 |
   | `mark` / `color` | タイルの文字と色（`stone` `green` `blue` `red` `purple` `gold`） |
   | `cover` | ページ上部のカバー画像 |
   | `badge` | カード左上の小ラベル（例: アーカイブ） |
   | `tag` / `date` / `author` | お知らせ用。`date` は `2026-02-08T22:10` 形式 |

2. `data/pages/kr-route-map.json` を作り、本文を書く

   ```json
   { "blocks": [
     { "type": "h1", "text": "【概要】" },
     { "type": "p", "text": "本文です。" }
   ] }
   ```

3. 親ページの本文に `{ "type": "links", "pages": ["kr-route-map"] }` を足すとリンクが表示されます。
   トップに出したい場合は `data/site.json` の `sections[].pages` に `id` を追加します。

`blocks` が空（`[]`）のページは「このページは準備中です。」と表示されます。

### お知らせを追加する

`data/pages.json` に `"section": "news"` と `tag` / `date` / `author` を付けたページを追加し、
`data/site.json` の `sections` → `news` の `pages` に `id` を足します（日付の新しい順に自動で並びます）。
タグの色は `site.json` の `tagColors` で指定します。

### 本文で使えるブロック

| type | 用途 | 主なキー |
|---|---|---|
| `h1` `h2` `h3` | 見出し（目次に自動で載る） | `text` |
| `p` | 段落 | `text`, `style`（`muted` / `note` / `lead`） |
| `ul` `ol` | 箇条書き | `items`（文字列、または `{ "text", "children": [] }`） |
| `quote` | 引用 | `text` |
| `callout` | 枠付きの補足 | `icon`, `title`, `blocks` |
| `table` | 表 | `head`, `rows` |
| `kv` | 項目と値の一覧 | `items`（`[項目, 値]` の配列） |
| `image` | 画像（クリックで拡大） | `src`, `caption`, `alt` |
| `gallery` | 画像を並べて表示 | `images`（`image` と同じ形の配列） |
| `flows` | 生産フロー図 | `items`: `{ "title", "steps": [{ "text", "via", "note" }] }` |
| `records` | アンケート回答などのカード | `items`: `{ "title", "fields": [[項目, 値]] }` |
| `links` | 子ページへのリンク | `pages`（id の配列）, `style: "cards"` でカード表示 |
| `bookmark` | 外部リンクのカード | `url`, `title`, `description` |
| `toc` | 目次（置いた位置に表示） | なし |
| `placeholder` | 「準備中」表示 | `text`（省略可） |
| `divider` | 区切り線 | なし |

文章中では次の記法が使えます。

- `**太字**`
- `==ハイライト==`
- `[リンク文字](https://example.com)` / サイト内リンクは `[UDE HD.](p:ude-hd)`
- `\n` で改行

### 画像を追加する

`assets/img/` に置いて、`"src": "assets/img/ファイル名.webp"` のように指定します。
ファイル名は英数字にしておくと安全です。横幅1600px程度に縮小しておくと表示が軽くなります。

## 補足

- ルーティングはハッシュ方式（`#/p/<id>`）なので、GitHub Pages で個別ページを直接開いても404になりません。
- Minecraft は Mojang Studios / Microsoft の商標です。本サイトは公式とは関係ありません。
