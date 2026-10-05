# キチクラ 公式ポータル

茨城高専電気科OBによるMinecraftマルチサーバー「キチクラ（キチガイクラフト / Kichigai-Craft）」の公式ポータルです。

- 公開URL: https://kichigai-craft-server.github.io/Kichigai-Portal/
- タイトル画面はMinecraft Java Editionのスタート画面風。背景は閲覧端末のライト／ダークモードで切り替わります。

## ページを追加・編集する

ページはすべて `pages/` の中のMarkdownファイルです。書き方は [pages/README.md](pages/README.md) を、雛形は [pages/_templates/](pages/_templates/) を見てください。

| フォルダ | 表示される場所 |
|---|---|
| `pages/news/` | タイトル画面「お知らせ」 |
| `pages/diary/` | タイトル画面「日記」（Discord BOTが毎日投稿する予定） |
| `pages/orgs/` | タイトル画面「主要企業及び団体」 |
| `pages/acv/` | タイトル画面「アーカイブ」（旧Notionの全ページ） |

ファイルを置いて `main` にpushすると、GitHub Actions（`.github/workflows/pages.yml`）がページ一覧 `pages/index.json` を作り直して自動で公開します。

## タイトル画面・全体の設定

`config/site.json` で変更できます。

| 項目 | 内容 |
|---|---|
| `title.logo` | タイトルロゴ画像 |
| `title.splash` | ロゴ横の黄色い文字（複数書くとランダムで1つ表示） |
| `title.version` / `title.copyright` | 画面下の左右の文字 |
| `background.light` / `background.dark` | ライトモード／ダークモードの背景画像 |
| `background.blur` | タイトル画面の背景のぼかし（px。0でぼかしなし） |
| `menu` | タイトル画面のボタン（`half: true` で半分幅） |
| `sections` | 各フォルダの見出し・並び順・空のときの文言。`password` を書くとパスワード入力画面が出る（※Publicリポジトリでは誰でも中身を読めるため、目隠し程度の効果） |
| `list` | 一覧に出す本文の引用文字数（`excerptLength`）、検索対象にする本文の文字数（`searchTextLength`） |
| `tagColors` | お知らせのタグの色（`red` `green` `aqua` `gold` `purple` `yellow` `blue`） |
| `callouts` | `> [!NOTE]` などの枠のアイコンと見出し |
| `ui` | ボタンや案内の文言 |

## ローカルで確認する

```bash
node scripts/build-index.mjs
python3 -m http.server 8000
```

→ http://localhost:8000/

`pages/index.json` は自動生成ファイルなのでコミットしません（`.gitignore` 済み）。

## フォルダ構成

```
index.html               ページの外枠
config/site.json         タイトル画面・全体の設定
pages/                   ページ本文（Markdown）
  _templates/            雛形
  news/ diary/ orgs/     各セクション
  acv/                   アーカイブ
scripts/build-index.mjs  pages/ を走査して pages/index.json を作る
assets/
  css/style.css          デザイン
  js/app.js              Markdownを読み込んで描画する
  img/                   画像（背景・ロゴ・各ページの画像）
  icons/                 ファビコン類
.github/workflows/       自動公開の設定
```

## GitHub Pages の設定

Settings → Pages の Source は **GitHub Actions** にしてください（「Deploy from a branch」だとページ一覧が作られません）。

## クレジット

- フォント: [Monocraft](https://github.com/IdreesInc/Monocraft)（SIL Open Font License 1.1）、[DotGothic16](https://fonts.google.com/specimen/DotGothic16)（SIL Open Font License 1.1）
- Markdown: [marked](https://github.com/markedjs/marked)、[DOMPurify](https://github.com/cure53/DOMPurify)
- Minecraft は Mojang Studios / Microsoft の商標です。本サイトは公式とは関係ありません。
