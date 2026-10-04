// pages/<セクション>/*.md を走査して、サイトが読むページ一覧 pages/index.json を作る。
// GitHub Actions がpushのたびに実行する。ローカル確認時は `node scripts/build-index.mjs`。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(join(ROOT, 'config/site.json'), 'utf8'));

// 対応するのは「key: value」形式の1行だけのシンプルなYAML
function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^".*"$/.test(val)) {
      try { val = JSON.parse(val); } catch { val = val.slice(1, -1); }
    } else if (/^'.*'$/.test(val)) {
      val = val.slice(1, -1).replace(/''/g, "'");
    } else {
      val = val.replace(/\s+#.*$/, '');
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
    }
    if (val !== '') data[key] = val;
  }
  return { data, body: src.slice(m[0].length) };
}

const isLocal = (p) => typeof p === 'string' && !/^([a-z]+:|\/\/|\/)/i.test(p);

const listConf = config.list || {};
const EXCERPT = listConf.excerptLength ?? 20;
const SEARCH = listConf.searchTextLength ?? 500;

// 本文からMarkdownの記号を取り除いて、一覧の引用・検索用のプレーンテキストにする
function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s*\[![A-Z]+\]\s*$/gim, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' ')
    .replace(/\*\*|__|~~|[*`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 本文中の最初の画像（ヘッダー画像がないときのアイコンに使う）
function firstImage(md) {
  const m = /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(md);
  return m ? m[1] : null;
}

const pages = [];
const warnings = [];

for (const [section, sec] of Object.entries(config.sections)) {
  const dir = join(ROOT, sec.folder);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.md') || file.startsWith('_') || file.toLowerCase() === 'readme.md') continue;
    const slug = file.slice(0, -3);
    const path = posix.join(sec.folder, file);
    const { data, body } = parseFrontMatter(readFileSync(join(dir, file), 'utf8'));
    if (data.draft === true) continue;
    if (!data.title) warnings.push(`${path}: title がありません（ファイル名で代用します）`);
    if (!data.cover && !data.thumb) {
      const img = firstImage(body);
      if (img) data.image = img;
    }
    for (const key of ['thumb', 'cover', 'image']) {
      if (isLocal(data[key])) data[key] = posix.normalize(posix.join(sec.folder, data[key]));
    }
    if (data.date !== undefined) data.date = String(data.date);
    const text = plainText(body);
    const chars = [...text];
    const excerpt = chars.length > EXCERPT ? chars.slice(0, EXCERPT).join('') + '…' : text;
    pages.push({ ...data, title: String(data.title ?? slug), section, slug, path, excerpt, text: chars.slice(0, SEARCH).join('') });
  }
}

for (const p of pages) {
  if (p.parent && !pages.some((q) => q.section === p.section && q.slug === p.parent)) {
    warnings.push(`${p.path}: parent「${p.parent}」が同じフォルダに見つかりません`);
  }
}

writeFileSync(join(ROOT, 'pages/index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pages }, null, 2) + '\n');
warnings.forEach((w) => console.warn('⚠ ' + w));
console.log(`pages/index.json: ${pages.length} ページ`);
