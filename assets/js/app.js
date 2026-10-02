/* キチクラ 公式ポータル
 * 文章・ページ構成はすべて data/ 以下の JSON から読み込んで描画する。
 * ルーティング（ハッシュ方式。GitHub Pages でも404にならない）:
 *   #/              トップ
 *   #/s/<section>   トップの該当セクションへスクロール
 *   #/p/<id>        各ページ
 *   #/p/<id>/<h-n>  ページ内の見出しへスクロール
 */
(() => {
  'use strict';

  const main = document.getElementById('main');
  const state = { site: null, pages: [], byId: new Map(), bodies: new Map(), current: null };

  // ---------- utils ----------
  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const pageHref = (id, anchor) => `#/p/${encodeURIComponent(id)}${anchor ? '/' + anchor : ''}`;

  function safeHref(url) {
    if (url.startsWith('p:')) return pageHref(url.slice(2));
    if (/^(https?:|mailto:|#|\.{0,2}\/|[\w-]+\.)/i.test(url) && !/^javascript:/i.test(url)) return url;
    return '#';
  }

  // インライン記法: **太字**  ==ハイライト==  `コード`  [文字](URL または p:ページID)  改行
  function inline(src = '') {
    let s = esc(src);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const raw = url.replace(/&amp;/g, '&');
      const href = safeHref(raw);
      const ext = /^https?:/i.test(raw) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${esc(href)}"${ext}>${text}</a>`;
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
    s = s.replace(/`(.+?)`/g, '<code>$1</code>');
    return s.replace(/\n/g, '<br>');
  }
  const plain = (src = '') => String(src).replace(/\*\*|==|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n/g, ' ');

  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || '');
    if (!m) return iso || '';
    const d = `${+m[1]}年${+m[2]}月${+m[3]}日`;
    return m[4] ? `${d} ${+m[4]}:${m[5]}` : d;
  }

  async function getJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  }

  async function getBody(id) {
    if (!state.bodies.has(id)) {
      state.bodies.set(id, getJSON(`data/pages/${encodeURIComponent(id)}.json`).catch(() => ({ blocks: [] })));
    }
    return state.bodies.get(id);
  }

  const ui = (key) => (state.site && state.site.ui && state.site.ui[key]) || '';

  // ---------- page parts ----------
  function ancestors(page) {
    const chain = [];
    let p = page;
    while (p && p.parent) {
      p = state.byId.get(p.parent);
      if (p) chain.unshift(p);
    }
    return chain;
  }

  function tagHTML(tag) {
    if (!tag) return '';
    const color = (state.site.tagColors || {})[tag];
    return `<span class="tag${color ? ' tag-' + esc(color) : ''}">${esc(tag)}</span>`;
  }

  function thumbHTML(p) {
    if (p.thumb) return `<img src="${esc(p.thumb)}" alt="" loading="lazy">`;
    const mark = p.mark || (p.icon || plain(p.title).slice(0, 2));
    return `<span class="card__mark tile-${esc(p.color || 'stone')}">${esc(mark)}</span>`;
  }

  function cardHTML(p) {
    const summary = p.summary || ui('sectionPlaceholder');
    return `<a class="card" href="${pageHref(p.id)}">
      <div class="card__thumb">${thumbHTML(p)}</div>
      <div class="card__body">
        ${p.badge ? `<span class="card__badge">${esc(p.badge)}</span>` : ''}
        <span class="card__title">${esc(p.title)}</span>
        <span class="card__sum">${esc(summary)}</span>
      </div>
    </a>`;
  }

  // ---------- block renderers ----------
  function renderBlocks(blocks, ctx) {
    return (blocks || []).map((b) => {
      const fn = R[b.type];
      if (!fn) { console.warn('未対応のブロック:', b); return ''; }
      return fn(b, ctx);
    }).join('');
  }

  function heading(level, b, ctx) {
    const id = `h-${++ctx.hn}`;
    ctx.headings.push({ id, level, text: b.toc || plain(b.text) });
    return `<h${level} id="${id}">${inline(b.text)}</h${level}>`;
  }

  function listItems(items) {
    return (items || []).map((it) => {
      if (typeof it === 'string') return `<li>${inline(it)}</li>`;
      const kids = it.children && it.children.length ? `<ul>${listItems(it.children)}</ul>` : '';
      return `<li>${inline(it.text)}${kids}</li>`;
    }).join('');
  }

  function figureHTML(img) {
    return `<figure class="figure">
      <button type="button" class="figure__btn" data-zoom="${esc(img.src)}" data-caption="${esc(plain(img.caption || ''))}" aria-label="画像を拡大">
        <img src="${esc(img.src)}" alt="${esc(img.alt || plain(img.caption || ''))}" loading="lazy">
      </button>
      ${img.caption ? `<figcaption>${inline(img.caption)}</figcaption>` : ''}
    </figure>`;
  }

  const R = {
    h1: (b, ctx) => heading(1, b, ctx),
    h2: (b, ctx) => heading(2, b, ctx),
    h3: (b, ctx) => heading(3, b, ctx),
    p: (b) => `<p${b.style ? ` class="is-${esc(b.style)}"` : ''}>${inline(b.text)}</p>`,
    ul: (b) => `<ul>${listItems(b.items)}</ul>`,
    ol: (b) => `<ol>${listItems(b.items)}</ol>`,
    quote: (b) => `<blockquote>${inline(b.text)}</blockquote>`,
    divider: () => '<hr>',
    placeholder: (b) => `<p class="placeholder">${esc(b.text || ui('sectionPlaceholder'))}</p>`,
    callout: (b, ctx) => `<aside class="callout">
      <div class="callout__icon" aria-hidden="true">${esc(b.icon || '💡')}</div>
      <div class="callout__body">
        ${b.title ? `<p class="callout__title">${inline(b.title)}</p>` : ''}
        ${renderBlocks(b.blocks, ctx)}
      </div>
    </aside>`,
    table: (b) => `<div class="table-wrap"><table>
      ${b.head ? `<thead><tr>${b.head.map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead>` : ''}
      <tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`,
    kv: (b) => `<dl class="kv">${(b.items || []).map(([k, v]) => `<dt>${inline(k)}</dt><dd>${inline(v)}</dd>`).join('')}</dl>`,
    image: (b) => figureHTML(b),
    gallery: (b) => `<div class="gallery">${(b.images || []).map(figureHTML).join('')}</div>`,
    bookmark: (b) => `<a class="bookmark" href="${esc(safeHref(b.url))}" target="_blank" rel="noopener noreferrer">
      <div class="bookmark__title">${esc(b.title || b.url)}</div>
      ${b.description ? `<div class="bookmark__desc">${esc(b.description)}</div>` : ''}
      <div class="bookmark__url">${esc(b.url)}</div>
    </a>`,
    flows: (b) => `<div class="flows">${(b.items || []).map((f) => `<section class="flow">
      ${f.title ? `<h4 class="flow__title">${inline(f.title)}</h4>` : ''}
      ${(f.steps || []).map((s, i) => `${i > 0 ? `<div class="flow__arrow">${s.via ? `<span class="flow__via">${esc(s.via)}</span>` : ''}</div>` : ''}
        <div class="flow__node">${inline(s.text)}${s.note ? `<span class="flow__note">（${esc(s.note)}）</span>` : ''}</div>`).join('')}
    </section>`).join('')}</div>`,
    records: (b) => `<div class="records">${(b.items || []).map((r) => `<article class="record">
      <h4 class="record__title">${esc(r.title)}</h4>
      <dl>${(r.fields || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${inline(v)}</dd></div>`).join('')}</dl>
    </article>`).join('')}</div>`,
    links: (b) => {
      const pages = (b.pages || []).map((id) => state.byId.get(id)).filter(Boolean);
      if (b.style === 'cards') return `<div class="cards">${pages.map(cardHTML).join('')}</div>`;
      return `<ul class="link-list">${pages.map((p) => `<li><a href="${pageHref(p.id)}">
        <span class="link-list__icon" aria-hidden="true">${esc(p.icon || '📄')}</span>
        <span class="link-list__title">${esc(p.title)}</span>
        ${p.summary ? `<span class="link-list__sum">${esc(p.summary)}</span>` : ''}
      </a></li>`).join('')}</ul>`;
    },
    toc: () => '<!--TOC-->',
  };

  function tocHTML(pageId, headings) {
    if (!headings.length) return '';
    return `<nav class="toc" aria-label="${esc(ui('toc'))}">
      <p class="toc__label">${esc(ui('toc'))}</p>
      <ol>${headings.map((h) => `<li class="lv${h.level}"><a href="${pageHref(pageId, h.id)}">${esc(h.text)}</a></li>`).join('')}</ol>
    </nav>`;
  }

  // ---------- views ----------
  function renderHome() {
    const s = state.site;
    const hero = s.hero || {};
    const jump = (s.nav || []).map((n) => `<li><a href="#/s/${esc(n.section)}">${esc(n.label)}</a></li>`).join('');

    const sections = (s.sections || []).map((sec) => {
      const pages = (sec.pages || []).map((id) => state.byId.get(id)).filter(Boolean);
      let body;
      if (sec.type === 'news') {
        pages.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        body = `<ul class="news">${pages.map((p) => `<li><a href="${pageHref(p.id)}">
          <time class="news__date" datetime="${esc(p.date || '')}">${esc(formatDate(p.date))}</time>
          ${tagHTML(p.tag)}
          <span class="news__title">${esc(p.title)}</span>
          <span class="news__author">${esc(p.author || '')}</span>
        </a></li>`).join('')}</ul>`;
      } else {
        body = `<div class="cards">${pages.map(cardHTML).join('')}</div>`;
      }
      return `<section class="home-section" id="sec-${esc(sec.id)}" aria-labelledby="sec-${esc(sec.id)}-title">
        <h2 class="section-title" id="sec-${esc(sec.id)}-title"><span aria-hidden="true">${esc(sec.icon || '')}</span>${esc(sec.title)}</h2>
        ${body}
      </section>`;
    }).join('');

    main.innerHTML = `
      ${hero.cover ? `<div class="cover${hero.coverFit === 'contain' ? ' cover--contain' : ''}"><img src="${esc(hero.cover)}" alt="${esc(hero.coverAlt || '')}"></div>` : ''}
      <div class="page-head${hero.cover ? ' page-head--with-cover' : ''}">
        <img class="home-logo" src="${esc(s.logo)}" alt="キチクラ ロゴ">
        <h1 class="page-title">${esc(s.siteName)}</h1>
        ${s.tagline ? `<p class="page-sub">${esc(s.tagline)}</p>` : ''}
        ${(hero.lead || []).map((t) => `<p class="home-lead">${inline(t)}</p>`).join('')}
        <ul class="home-jump">${jump}</ul>
      </div>
      ${sections}`;
    document.title = s.siteName;
  }

  async function renderPage(id) {
    const page = state.byId.get(id);
    if (!page) return renderNotFound();

    const body = await getBody(id);
    if (state.current !== id) return; // 読み込み中に別ページへ移動した

    const chain = ancestors(page);
    const crumbs = [`<li><a href="#/">${esc(ui('home'))}</a></li>`]
      .concat(chain.map((p) => `<li><a href="${pageHref(p.id)}">${esc(p.title)}</a></li>`))
      .concat(`<li aria-current="page">${esc(page.title)}</li>`).join('');

    const meta = page.section === 'news' ? `<dl class="meta">
      ${page.tag ? `<dt>${esc(ui('tag'))}</dt><dd>${tagHTML(page.tag)}</dd>` : ''}
      ${page.date ? `<dt>${esc(ui('date'))}</dt><dd><time datetime="${esc(page.date)}">${esc(formatDate(page.date))}</time></dd>` : ''}
      ${page.author ? `<dt>${esc(ui('author'))}</dt><dd>${esc(page.author)}</dd>` : ''}
    </dl>` : '';

    const ctx = { hn: 0, headings: [] };
    const blocks = body.blocks || [];
    let content = blocks.length ? renderBlocks(blocks, ctx) : `<p class="placeholder">${esc(ui('placeholder'))}</p>`;
    content = content.replace('<!--TOC-->', tocHTML(id, ctx.headings)).replace(/<!--TOC-->/g, '');

    const parent = chain[chain.length - 1];
    const back = parent
      ? `<a href="${pageHref(parent.id)}">← ${esc(parent.title)} ${esc(ui('backToParent'))}</a>`
      : `<a href="#/${page.section ? 's/' + esc(page.section) : ''}">← ${esc(ui('backToTop'))}</a>`;

    main.innerHTML = `
      <nav class="breadcrumbs" aria-label="パンくずリスト"><ol>${crumbs}</ol></nav>
      ${page.cover ? `<div class="cover" style="margin-top:16px"><img src="${esc(page.cover)}" alt=""></div>` : ''}
      <header class="page-head${page.cover ? ' page-head--with-cover' : ''}">
        ${page.icon ? `<div class="page-head__icon" aria-hidden="true">${esc(page.icon)}</div>` : ''}
        <h1 class="page-title">${esc(page.title)}</h1>
        ${meta}
      </header>
      <article class="content">${content}</article>
      <div class="page-foot">${back}</div>`;
    document.title = `${plain(page.title)} | ${state.site.siteName}`;
  }

  function renderNotFound() {
    main.innerHTML = `<div class="page-head">
      <h1 class="page-title">${esc(ui('notFoundTitle'))}</h1>
      <p>${esc(ui('notFoundBody'))}</p>
      <p><a href="#/">← ${esc(ui('backToTop'))}</a></p>
    </div>`;
    document.title = `${ui('notFoundTitle')} | ${state.site.siteName}`;
  }

  function scrollToId(elId) {
    const el = elId && document.getElementById(elId);
    if (el) el.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }

  // ---------- router ----------
  async function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [kind, id, anchor] = parts;

    if (kind === 'p' && id) {
      if (state.current === id && main.querySelector('.content')) { // 同一ページ内の見出し移動
        scrollToId(anchor);
        return;
      }
      state.current = id;
      await renderPage(id);
      if (state.current !== id) return;
      scrollToId(anchor);
      main.focus({ preventScroll: true });
      return;
    }

    const wasHome = state.current === '__home__' && main.querySelector('.home-section');
    state.current = '__home__';
    if (!wasHome) renderHome();
    if (kind === 's' && id) scrollToId(`sec-${id}`);
    else if (!wasHome || !kind) window.scrollTo(0, 0);
  }

  // ---------- chrome (header / footer / lightbox) ----------
  function renderChrome() {
    const s = state.site;
    document.querySelectorAll('[data-site="siteName"]').forEach((el) => { el.textContent = s.siteName; });
    document.getElementById('site-nav').innerHTML = (s.nav || [])
      .map((n) => `<a href="#/s/${esc(n.section)}">${esc(n.label)}</a>`).join('');
    const f = s.footer || {};
    document.getElementById('site-footer').innerHTML = `
      <img src="${esc(s.logo)}" alt="">
      <div>${(f.lines || []).map((l) => `<p>${inline(l)}</p>`).join('')}</div>`;
  }

  function setupLightbox() {
    const dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const img = dlg.querySelector('.lightbox__img');
    const cap = dlg.querySelector('.lightbox__caption');
    main.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-zoom]');
      if (!btn) return;
      img.src = btn.dataset.zoom;
      img.alt = btn.dataset.caption || '';
      cap.textContent = btn.dataset.caption || '';
      dlg.showModal();
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target === img) dlg.close(); });
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const [site, pages] = await Promise.all([getJSON('data/site.json'), getJSON('data/pages.json')]);
      state.site = site;
      state.pages = pages;
      pages.forEach((p) => state.byId.set(p.id, p));
    } catch (err) {
      console.error(err);
      main.innerHTML = `<p class="state-message">データの読み込みに失敗しました。ローカルで確認する場合は、HTTPサーバー経由で開いてください（例: python3 -m http.server）。</p>`;
      return;
    }
    renderChrome();
    setupLightbox();
    window.addEventListener('hashchange', route);
    route();
  }

  boot();
})();
