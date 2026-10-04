/* キチクラ 公式ポータル
 * 設定は config/site.json、ページは pages/<セクション>/*.md（一覧は pages/index.json）から読み込んで描画する。
 * ルーティング（ハッシュ方式。GitHub Pages でも404にならない）:
 *   #/                        タイトル画面
 *   #/<section>               セクションの一覧（news / seasons / orgs / acv）
 *   #/<section>/<slug>        ページ（pages/<section>/<slug>.md）
 *   #/<section>/<slug>/<h-n>  ページ内の見出しへスクロール
 */
(() => {
  'use strict';

  const app = document.getElementById('app');
  const SITE_ROOT = new URL('.', document.baseURI).href;
  const state = { config: null, pages: [], md: new Map(), route: '' };

  // ---------- utils ----------
  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const ui = (k) => (state.config.ui || {})[k] || '';
  const sectionOf = (key) => state.config.sections[key];
  const pageHref = (p, anchor) => `#/${encodeURIComponent(p.section)}/${encodeURIComponent(p.slug)}${anchor ? '/' + anchor : ''}`;
  const findPage = (section, slug) => state.pages.find((p) => p.section === section && p.slug === slug);

  async function getJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }

  function getMarkdown(page) {
    if (!state.md.has(page.path)) {
      state.md.set(page.path, fetch(page.path, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')));
    }
    return state.md.get(page.path);
  }

  function formatDate(v) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(v || '');
    if (!m) return v || '';
    const d = `${+m[1]}年${+m[2]}月${+m[3]}日`;
    return m[4] ? `${d} ${+m[4]}:${m[5]}` : d;
  }

  function sortPages(list, how) {
    const arr = list.slice();
    if (how === 'date') return arr.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return arr.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.title.localeCompare(b.title, 'ja'));
  }

  function tagHTML(tag) {
    if (!tag) return '';
    const color = (state.config.tagColors || {})[tag];
    return `<span class="tag${color ? ' tag-' + esc(color) : ''}">${esc(tag)}</span>`;
  }

  function ancestors(page) {
    const chain = [];
    let p = page;
    const seen = new Set();
    while (p && p.parent && !seen.has(p.parent)) {
      seen.add(p.parent);
      p = findPage(page.section, p.parent);
      if (p) chain.unshift(p);
    }
    return chain;
  }

  // ---------- 共通パーツ ----------
  function setMode(mode) {
    document.body.classList.toggle('is-menu', mode === 'menu');
  }

  function screenHTML({ crumbs = [], title, sub = '', body, foot }) {
    const c = state.config;
    const crumbHTML = [`<li><a href="#/">${esc(ui('toTitle'))}</a></li>`]
      .concat(crumbs.map((x) => (x.href ? `<li><a href="${x.href}">${esc(x.label)}</a></li>` : `<li aria-current="page">${esc(x.label)}</li>`)))
      .join('');
    return `<div class="screen">
      <header class="screen-head">
        <a class="screen-head__logo" href="#/" aria-label="${esc(ui('toTitle'))}"><img src="${esc(c.smallLogo)}" alt=""></a>
        <nav class="crumbs" aria-label="パンくずリスト"><ol>${crumbHTML}</ol></nav>
      </header>
      <h1 class="screen-title">${esc(title)}</h1>
      ${sub ? `<p class="screen-sub">${sub}</p>` : ''}
      <div class="panel">${body}</div>
      <div class="screen-foot">${foot}</div>
      <p class="disclaimer">${esc(c.disclaimer || '')}</p>
    </div>`;
  }

  function iconHTML(p) {
    if (p.thumb) return `<img src="${esc(p.thumb)}" alt="" loading="lazy">`;
    const fallback = (sectionOf(p.category) || sectionOf(p.section) || {}).defaultMark;
    const mark = p.mark || p.icon || fallback || [...p.title.replace(/[「」『』【】（）()\s“”"]/g, '')].slice(0, 2).join('');
    return `<span class="tile tile-${esc(p.color || 'stone')}">${esc(mark)}</span>`;
  }

  function entryHTML(p) {
    const meta = [
      p.date ? `<time datetime="${esc(p.date)}">${esc(formatDate(p.date))}</time>` : '',
      tagHTML(p.tag),
      p.author ? `<span>${esc(p.author)}</span>` : '',
      p.badge ? `<span class="entry__badge">${esc(p.badge)}</span>` : '',
    ].filter(Boolean).join('');
    return `<li><a class="entry" href="${pageHref(p)}">
      <span class="entry__icon">${iconHTML(p)}</span>
      <span class="entry__main">
        <span class="entry__title">${esc(p.title)}</span>
        ${p.summary ? `<span class="entry__sub">${esc(p.summary)}</span>` : ''}
        ${meta ? `<span class="entry__meta">${meta}</span>` : ''}
      </span>
    </a></li>`;
  }

  const backBtn = (href) => `<a class="mc-btn" href="${href}">${esc(ui('back'))}</a>`;
  const titleBtn = () => `<a class="mc-btn" href="#/">${esc(ui('toTitle'))}</a>`;

  // ---------- タイトル画面 ----------
  function renderTitle() {
    const t = state.config.title || {};
    const splashes = t.splash || [];
    const splash = splashes.length ? splashes[Math.floor(Math.random() * splashes.length)] : '';
    const full = [];
    const half = [];
    (state.config.menu || []).forEach((m) => {
      const ext = !!m.href;
      const href = ext ? m.href : `#/${encodeURIComponent(m.section)}`;
      const html = `<a class="mc-btn${m.half ? ' mc-btn--half' : ''}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(m.label)}</a>`;
      (m.half ? half : full).push(html);
    });
    setMode('title');
    app.innerHTML = `<div class="title-screen">
      <h1 class="title-logo">
        <img src="${esc(t.logo)}" alt="${esc(t.logoAlt || state.config.siteName)}" width="1320" height="169">
        ${splash ? `<span class="splash">${esc(splash)}</span>` : ''}
      </h1>
      <nav class="title-menu" aria-label="メインメニュー">
        ${full.join('')}
        ${half.length ? `<div class="title-menu__row">${half.join('')}</div>` : ''}
      </nav>
      <div class="title-foot">
        <p>${esc(t.version || '')}</p>
        <p>${esc(t.copyright || '')}</p>
      </div>
    </div>`;
    document.title = state.config.siteName;
  }

  // ---------- 一覧画面 ----------
  function renderSection(key) {
    const sec = sectionOf(key);
    if (!sec) return renderNotFound();
    const top = state.pages.filter((p) => p.section === key && !p.parent);
    let body;
    if (sec.groupBy && sec.groups) {
      const used = new Set();
      body = sec.groups.map((g) => {
        const list = top.filter((p) => p[sec.groupBy] === g.key);
        list.forEach((p) => used.add(p));
        if (!list.length) return '';
        return `<h2 class="group-title">${esc(g.title)}</h2><ul class="entries">${sortPages(list, g.sort).map(entryHTML).join('')}</ul>`;
      }).join('');
      const rest = top.filter((p) => !used.has(p));
      if (rest.length) body += `<h2 class="group-title">その他</h2><ul class="entries">${sortPages(rest, sec.sort).map(entryHTML).join('')}</ul>`;
    } else {
      body = top.length ? `<ul class="entries">${sortPages(top, sec.sort).map(entryHTML).join('')}</ul>` : '';
    }
    if (!top.length) {
      body = `<p class="empty">${esc(sec.empty || '')}<br><small><code>${esc(sec.folder)}/</code> にMarkdownファイルを追加すると、ここに表示されます。</small></p>`;
    }
    setMode('menu');
    app.innerHTML = screenHTML({ crumbs: [{ label: sec.title }], title: sec.title, body, foot: backBtn('#/') });
    document.title = `${sec.title} | ${state.config.siteName}`;
  }

  // ---------- ページ ----------
  // pages/<section>/<slug>.md へのリンクをサイト内ルートに変換する
  function toRoute(absUrl) {
    if (!absUrl.startsWith(SITE_ROOT)) return null;
    const rel = decodeURIComponent(absUrl.slice(SITE_ROOT.length).split(/[?#]/)[0]);
    const m = /^pages\/([^/]+)\/([^/]+)\.md$/.exec(rel);
    if (!m) return null;
    const p = findPage(m[1], m[2]);
    return p ? pageHref(p) : null;
  }

  function enhance(root, page, ctx) {
    const base = new URL(page.path, SITE_ROOT);
    const isRel = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u);

    root.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      if (isRel(src)) img.src = new URL(src, base).href;
      img.loading = 'lazy';
    });
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (isRel(href)) {
        const abs = new URL(href, base).href;
        a.setAttribute('href', toRoute(abs) || abs);
      } else if (/^https?:/i.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });

    // GitHub形式のアラート（> [!NOTE] など）をコールアウトに
    root.querySelectorAll('blockquote').forEach((bq) => {
      const first = bq.firstElementChild;
      if (!first || first.tagName !== 'P') return;
      const m = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.innerHTML);
      if (!m) return;
      const type = m[1].toUpperCase();
      const def = (state.config.callouts || {})[type] || { icon: 'ℹ️', label: type };
      first.innerHTML = first.innerHTML.slice(m[0].length).replace(/^<br>\s*/, '');
      if (!first.textContent.trim() && !first.querySelector('img')) first.remove();
      const aside = document.createElement('aside');
      aside.className = `callout callout--${type}`;
      aside.innerHTML = `<div class="callout__head"><span aria-hidden="true">${esc(def.icon)}</span>${esc(def.label)}</div>`;
      while (bq.firstChild) aside.appendChild(bq.firstChild);
      bq.replaceWith(aside);
    });

    // ```flow ブロックを生産フロー図に
    root.querySelectorAll('pre > code.language-flow').forEach((code) => {
      const lines = code.textContent.split('\n').map((l) => l.trim()).filter(Boolean);
      let title = '';
      if (/^title\s*:/i.test(lines[0] || '')) title = lines.shift().replace(/^title\s*:\s*/i, '');
      const parts = lines.map((l, i) => {
        const arrow = /^(↓|v|->)\s*(.*)$/.exec(l);
        if (arrow) return `<div class="flow__arrow">${arrow[2] ? `<span>${esc(arrow[2])}</span>` : ''}</div>`;
        const node = `<div class="flow__node">${DOMPurify.sanitize(marked.parseInline(l))}</div>`;
        const prevIsNode = i > 0 && !/^(↓|v|->)/.test(lines[i - 1]);
        return (prevIsNode ? '<div class="flow__arrow"></div>' : '') + node;
      }).join('');
      const sec = document.createElement('section');
      sec.className = 'flow';
      sec.innerHTML = `${title ? `<h5 class="flow__title">${DOMPurify.sanitize(marked.parseInline(title))}</h5>` : ''}${parts}`;
      code.parentElement.replaceWith(sec);
    });
    // 連続するフローを横並びに
    root.querySelectorAll('.flow').forEach((f) => {
      if (f.parentElement.classList.contains('flows')) return;
      const wrap = document.createElement('div');
      wrap.className = 'flows';
      f.before(wrap);
      let n = f;
      while (n && n.classList && n.classList.contains('flow')) {
        const next = n.nextElementSibling;
        wrap.appendChild(n);
        n = next;
      }
    });

    // 画像だけの段落 → 1枚なら図、複数ならギャラリー
    root.querySelectorAll('p').forEach((p) => {
      const imgs = [...p.querySelectorAll(':scope > img, :scope > a > img')];
      if (!imgs.length) return;
      const rest = p.cloneNode(true);
      rest.querySelectorAll('img, br').forEach((x) => x.remove());
      if (rest.textContent.trim()) return;
      const figs = imgs.map((img) => {
        const cap = img.getAttribute('title') || '';
        img.removeAttribute('title');
        return `<figure class="figure"><button type="button" class="figure__btn" data-zoom="${esc(img.src)}" data-caption="${esc(cap)}" aria-label="画像を拡大">${img.outerHTML}</button>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
      });
      const div = document.createElement('div');
      if (figs.length > 1) div.className = 'gallery';
      div.innerHTML = figs.join('');
      p.replaceWith(...(figs.length > 1 ? [div] : div.childNodes));
    });

    root.querySelectorAll('table').forEach((t) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.before(w);
      w.appendChild(t);
    });

    // 見出しに番号を振って目次を作る
    let n = 0;
    root.querySelectorAll('h2, h3, h4').forEach((h) => {
      h.id = `h-${++n}`;
      ctx.headings.push({ id: h.id, level: +h.tagName[1], text: h.textContent });
    });
  }

  async function renderPage(section, slug, anchor) {
    const page = findPage(section, slug);
    const sec = sectionOf(section);
    if (!page || !sec) return renderNotFound();

    const md = await getMarkdown(page);
    if (state.route !== `${section}/${slug}`) return;

    const ctx = { headings: [] };
    const body = document.createElement('article');
    body.className = 'md';
    body.innerHTML = md.trim()
      ? DOMPurify.sanitize(marked.parse(md, { gfm: true }), { ADD_ATTR: ['target'] })
      : `<p class="empty">${esc(ui('placeholder'))}</p>`;
    enhance(body, page, ctx);

    if (page.toc && ctx.headings.length) {
      const toc = document.createElement('nav');
      toc.className = 'toc';
      toc.setAttribute('aria-label', ui('toc'));
      toc.innerHTML = `<p class="toc__label">${esc(ui('toc'))}</p><ol>${ctx.headings
        .map((h) => `<li class="lv${h.level}"><a href="${pageHref(page, h.id)}">${esc(h.text)}</a></li>`).join('')}</ol>`;
      body.prepend(toc);
    }

    // 子ページのうち、本文からリンクされていないものを「関連ページ」に並べる
    const linked = new Set([...body.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')));
    const children = sortPages(state.pages.filter((p) => p.section === section && p.parent === slug), 'order')
      .filter((p) => !linked.has(pageHref(p)));
    const childHTML = children.length
      ? `<div class="children"><p class="children__label">${esc(ui('children'))}</p><ul class="entries">${children.map(entryHTML).join('')}</ul></div>`
      : '';

    const repo = state.config.repo;
    const tools = repo && repo.url
      ? `<div class="page-tools"><a href="${esc(`${repo.url}/edit/${repo.branch || 'main'}/${page.path}`)}" target="_blank" rel="noopener noreferrer">${esc(ui('editOnGitHub'))}</a></div>`
      : '';

    const chain = ancestors(page);
    const crumbs = [{ label: sec.title, href: `#/${section}` }]
      .concat(chain.map((p) => ({ label: p.title, href: pageHref(p) })))
      .concat({ label: page.title });
    const parent = chain[chain.length - 1];
    const sub = [
      page.icon ? `<span aria-hidden="true">${esc(page.icon)}</span>` : '',
      page.date ? `<time datetime="${esc(page.date)}">${esc(formatDate(page.date))}</time>` : '',
      tagHTML(page.tag),
      page.author ? `<span>${esc(ui('author'))}: ${esc(page.author)}</span>` : '',
    ].filter(Boolean).join(' ');

    setMode('menu');
    app.innerHTML = screenHTML({
      crumbs,
      title: page.title,
      sub,
      body: `${page.cover ? `<figure class="figure"><img src="${esc(page.cover)}" alt=""></figure>` : ''}<div class="md-slot"></div>${childHTML}${tools}`,
      foot: backBtn(parent ? pageHref(parent) : `#/${section}`) + titleBtn(),
    });
    app.querySelector('.md-slot').replaceWith(body);
    document.title = `${page.title} | ${state.config.siteName}`;

    const target = anchor && document.getElementById(anchor);
    if (target) target.scrollIntoView();
  }

  function renderNotFound() {
    setMode('menu');
    app.innerHTML = screenHTML({
      title: ui('notFoundTitle'),
      body: `<p class="empty">${esc(ui('notFoundBody'))}</p>`,
      foot: titleBtn(),
    });
    document.title = `${ui('notFoundTitle')} | ${state.config.siteName}`;
  }

  // ---------- ルーター ----------
  async function route() {
    let parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

    // 旧URL（#/p/<id>、#/s/<section>）からの転送
    if (parts[0] === 'p' && parts[1]) return location.replace(`#/acv/${parts.slice(1).join('/')}`);
    if (parts[0] === 's' && parts[1]) return location.replace(`#/${parts[1]}`);

    const [section, slug, anchor] = parts;
    const key = slug ? `${section}/${slug}` : section || '';
    const samePage = slug && state.route === key && app.querySelector('.md');
    state.route = key;

    if (samePage) {
      const t = anchor && document.getElementById(anchor);
      if (t) t.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
    if (!section) renderTitle();
    else if (!slug) renderSection(section);
    else await renderPage(section, slug, anchor);
    if (section) app.focus({ preventScroll: true });
  }

  function setupLightbox() {
    const dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const img = dlg.querySelector('.lightbox__img');
    const cap = dlg.querySelector('.lightbox__caption');
    app.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-zoom]');
      if (!btn) return;
      img.src = btn.dataset.zoom;
      img.alt = btn.dataset.caption || '';
      cap.textContent = btn.dataset.caption || '';
      dlg.showModal();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target === img) dlg.close(); });
  }

  async function boot() {
    try {
      const [config, index] = await Promise.all([getJSON('config/site.json'), getJSON('pages/index.json')]);
      state.config = config;
      state.pages = index.pages || [];
    } catch (err) {
      console.error(err);
      app.innerHTML = '<p class="state">データの読み込みに失敗しました。ローカルで確認する場合は <code>node scripts/build-index.mjs</code> のあと、HTTPサーバー経由で開いてください。</p>';
      return;
    }
    const bg = state.config.background || {};
    const root = document.documentElement.style;
    // CSS変数内の相対URLはCSSファイル基準で解決されるため、絶対URLにして渡す
    if (bg.light) root.setProperty('--bg-light', `url("${new URL(bg.light, SITE_ROOT).href}")`);
    if (bg.dark) root.setProperty('--bg-dark', `url("${new URL(bg.dark, SITE_ROOT).href}")`);

    setupLightbox();
    window.addEventListener('hashchange', route);
    route();
  }

  boot();
})();
