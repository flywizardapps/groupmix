/* Anleitung als Hilfe-Center: zeigt immer nur eine Ansicht (Übersicht, Kapitel, Artikel) per URL-Hash und bietet eine Volltextsuche.
   Ohne JavaScript bleibt die Seite eine lange Seite mit Inhaltsverzeichnis. Keine Bibliotheken, keine externen Ressourcen. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* Feste Texte je Sprache (nach <html lang>) */
  var STR = {
    de: {
      overviewId: 'uebersicht', title: 'Anleitung', suffix: ' – GroupMix', overview: 'Übersicht', find: 'Suchen',
      searchLabel: 'Anleitung durchsuchen', placeholder: 'Suchen', sideLabel: 'Inhalt der Anleitung', crumbsLabel: 'Brotkrumen',
      moreLabel: 'Weitere Artikel', prev: 'Vorheriger Artikel', next: 'Nächster Artikel',
      none: 'Keine Treffer', tip: 'Tipp: Versuche ein kürzeres oder allgemeineres Wort, zum Beispiel „Backup“ oder „Regel“.',
      count: function (n) { return n + ' Treffer'; }
    },
    en: {
      overviewId: 'overview', title: 'Guide', suffix: ' – GroupMix', overview: 'Overview', find: 'Search',
      searchLabel: 'Search the guide', placeholder: 'Search', sideLabel: 'Guide contents', crumbsLabel: 'Breadcrumb',
      moreLabel: 'More articles', prev: 'Previous', next: 'Next',
      none: 'No results', tip: 'Tip: Try a shorter or more general word, for example “backup” or “rule”.',
      count: function (n) { return n === 1 ? '1 result' : n + ' results'; }
    }
  };
  var L = STR[(root.getAttribute('lang') || 'de').slice(0, 2) === 'en' ? 'en' : 'de'];

  var content = document.getElementById('g-content');
  var overview = document.getElementById(L.overviewId);
  if (!content || !overview) return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var SUFFIX = L.suffix;
  var TITLE = L.title;

  /* ---------- Daten ---------- */
  var chapters = [].map.call(content.querySelectorAll('section.chapter'), function (el) {
    return { id: el.id, el: el, title: el.getAttribute('data-title'), articles: [] };
  });
  var chapterById = {};
  chapters.forEach(function (c) { chapterById[c.id] = c; });

  var articles = [];
  [].forEach.call(content.querySelectorAll('article.topic'), function (el) {
    var ch = chapterById[el.getAttribute('data-chapter')];
    var a = { id: el.id, el: el, title: el.querySelector('h2').textContent.trim(), chapter: ch };
    a.text = el.textContent.replace(/\s+/g, ' ').trim();
    if (a.text.indexOf(a.title) === 0) a.text = a.text.slice(a.title.length).trim(); /* Titel nicht doppelt im Ausschnitt */
    ch.articles.push(a);
    articles.push(a);
  });

  /* ---------- Normalisierung für die Suche ---------- */
  var MAP = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue' };
  /* Gibt den normalisierten Text und für jedes Zeichen den Index im Original zurück. */
  function norm(str) {
    var s = '', map = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i), r = MAP[c];
      if (r === undefined) r = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      for (var j = 0; j < r.length; j++) { s += r.charAt(j); map.push(i); }
    }
    return { s: s, map: map };
  }
  articles.forEach(function (a) { a.n = norm(a.text); a.nt = norm(a.title); });

  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* Markiert alle Treffer der Suchwörter im Originaltext, nur im Ausschnitt from..to. */
  function highlight(orig, n, terms, from, to) {
    var marks = [];
    terms.forEach(function (t) {
      var p = 0;
      while ((p = n.s.indexOf(t, p)) !== -1) {
        var a = n.map[p], b = n.map[p + t.length - 1] + 1;
        if (a >= from && b <= to) marks.push([a, b]);
        p += t.length;
      }
    });
    marks.sort(function (x, y) { return x[0] - y[0]; });
    var out = '', pos = from;
    marks.forEach(function (m) {
      if (m[1] <= pos) return;
      var a = Math.max(m[0], pos);
      out += esc(orig.slice(pos, a)) + '<mark>' + esc(orig.slice(a, m[1])) + '</mark>';
      pos = m[1];
    });
    return out + esc(orig.slice(pos, to));
  }

  /* Alle Wörter müssen vorkommen; Titeltreffer zuerst. Unter 2 Zeichen: keine Suche (null). */
  function search(query) {
    var nq = norm(query).s.trim();
    if (nq.replace(/\s/g, '').length < 2) return null;
    var terms = nq.split(/\s+/);
    var hits = [];
    articles.forEach(function (a) {
      var all = true, inTitle = true, first = Infinity;
      terms.forEach(function (t) {
        var p = a.n.s.indexOf(t), pt = a.nt.s.indexOf(t);
        if (p === -1 && pt === -1) all = false;
        if (pt === -1) inTitle = false;
        if (p !== -1 && p < first) first = p;
      });
      if (all) hits.push({ a: a, title: inTitle, pos: first });
    });
    hits.sort(function (x, y) { return (y.title - x.title) || (x.pos - y.pos); });
    return { terms: terms, hits: hits };
  }

  function snippet(a, terms) {
    var n = a.n, p = n.s.length;
    terms.forEach(function (t) { var q = n.s.indexOf(t); if (q !== -1 && q < p) p = q; });
    if (p === n.s.length) p = 0;
    var center = n.map[p];
    var from = Math.max(0, center - 50), to = Math.min(a.text.length, center + 110);
    if (from > 0) { var sp = a.text.indexOf(' ', from); if (sp !== -1 && sp < center) from = sp + 1; }
    if (to < a.text.length) { var sp2 = a.text.lastIndexOf(' ', to); if (sp2 > center) to = sp2; }
    return (from > 0 ? '… ' : '') + highlight(a.text, n, terms, from, to) + (to < a.text.length ? ' …' : '');
  }

  function renderResults(box, status, query) {
    var res = search(query), html;
    if (!res) {
      box.hidden = true; box.innerHTML = '';
      status.textContent = '';
      return null;
    }
    if (!res.hits.length) {
      html = '<div class="g-none"><p><strong>' + L.none + '</strong></p><p>' + L.tip + '</p></div>';
    } else {
      html = '<p class="g-count" aria-hidden="true">' + L.count(res.hits.length) + '</p><ol>' +
        res.hits.map(function (h) {
          var a = h.a;
          return '<li><a href="#' + a.id + '"><span class="r-chapter">' + esc(a.chapter.title) + '</span><span class="r-title">' +
            highlight(a.title, a.nt, res.terms, 0, a.title.length) + '</span><span class="r-snip">' + snippet(a, res.terms) + '</span></a></li>';
        }).join('') + '</ol>';
    }
    box.innerHTML = html;
    box.hidden = false;
    box.dataset.terms = res.terms.join(' ');
    status.textContent = res.hits.length ? L.count(res.hits.length) : L.none;
    return res;
  }

  /* Verbindet Eingabefeld und Ergebnisfläche; Esc leert, Enter öffnet den ersten Treffer. */
  function bindSearch(input, box, status, onChange) {
    function run() {
      var res = renderResults(box, status, input.value);
      onChange(!!res);
    }
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; run(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var first = box.querySelector('a');
        if (first) { pendingTerms = (box.dataset.terms || '').split(' ').filter(Boolean); location.hash = first.getAttribute('href'); }
      }
    });
    return run;
  }

  /* Suche in der Übersicht */
  var form = document.getElementById('g-search');
  var input = document.getElementById('g-q');
  var results = document.getElementById('g-results');
  var status = document.getElementById('g-status');
  form.hidden = false;
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  var runMain = bindSearch(input, results, status, function (active) {
    overview.classList.toggle('searching', active);
    var v = input.value.trim();
    if (root.getAttribute('data-view') === 'overview') history.replaceState(null, '', location.pathname + (v ? '?q=' + encodeURIComponent(v) : '') + location.hash);
  });

  /* Seitenleiste mit Suche (nur breit sichtbar) */
  var side = document.createElement('nav');
  side.className = 'g-side';
  side.setAttribute('aria-label', L.sideLabel);
  side.innerHTML =
    '<form class="g-search" role="search"><label for="g-q2" class="sr-only">' + L.searchLabel + '</label>' +
    '<input id="g-q2" type="search" placeholder="' + L.placeholder + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></form>' +
    '<div class="sr-only" id="g-status2" role="status" aria-live="polite"></div>' +
    '<div class="g-results" id="g-results2" hidden></div>' +
    '<ol class="g-side-list"><li><a href="#' + L.overviewId + '">' + L.overview + '</a></li>' +
    chapters.map(function (c) {
      return '<li data-chapter="' + c.id + '"><a href="#' + c.id + '">' + esc(c.title) + '</a>' +
        (c.articles.length > 1 ? '<ul>' + c.articles.map(function (a) {
          return '<li><a href="#' + a.id + '">' + esc(a.title) + '</a></li>';
        }).join('') + '</ul>' : '') + '</li>';
    }).join('') + '</ol>';
  content.parentNode.parentNode.insertBefore(side, content.parentNode);
  var input2 = side.querySelector('#g-q2'), results2 = side.querySelector('#g-results2'), list2 = side.querySelector('.g-side-list');
  side.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); });
  bindSearch(input2, results2, side.querySelector('#g-status2'), function (active) { list2.hidden = active; });

  /* Brotkrumen */
  var crumbs = document.createElement('div');
  crumbs.className = 'g-crumbs';
  content.parentNode.insertBefore(crumbs, content);

  /* Kapitellisten (Titel + erster Satz) und Blättern zwischen Artikeln */
  function preview(a) {
    if (a.el.dataset.summary) return a.el.dataset.summary;
    var p = a.el.querySelector(':scope > p, :scope > ol > li, :scope > ul > li');
    var t = p ? p.textContent.replace(/\s+/g, ' ').trim() : '';
    var m = t.match(/^.*?[.!?](?=\s|$)/);
    if (m && m[0].length >= 20) t = m[0];
    if (t.length > 150) t = t.slice(0, 147).replace(/\s+\S*$/, '') + ' …';
    return t;
  }
  chapters.forEach(function (c) {
    if (c.articles.length < 2) return;
    var ul = document.createElement('ul');
    ul.className = 'chapter-list';
    ul.innerHTML = c.articles.map(function (a) {
      return '<li><a href="#' + a.id + '"><span class="l-title">' + esc(a.title) + '</span><span class="l-sub">' + esc(preview(a)) + '</span></a></li>';
    }).join('');
    c.el.querySelector('.chapter-head').after(ul);
  });
  articles.forEach(function (a, i) {
    var prev = articles[i - 1], next = articles[i + 1], nav = document.createElement('nav');
    nav.className = 'pager';
    nav.setAttribute('aria-label', L.moreLabel);
    nav.innerHTML =
      (prev ? '<a class="prev" rel="prev" href="#' + prev.id + '"><small>← ' + L.prev + '</small><span class="p-title">' + esc(prev.title) + '</span></a>' : '') +
      (next ? '<a class="next" rel="next" href="#' + next.id + '"><small>' + L.next + ' →</small><span class="p-title">' + esc(next.title) + '</span></a>' : '');
    a.el.appendChild(nav);
  });

  /* ---------- Routing ---------- */
  var focusSearch = false;
  function crumbHtml(items) {
    return '<nav aria-label="' + L.crumbsLabel + '"><ol>' + items.map(function (it) {
      return '<li>' + (it.href ? '<a href="' + it.href + '">' + esc(it.text) + '</a>' : '<span aria-current="page">' + esc(it.text) + '</span>') + '</li>';
    }).join('') + '</ol></nav><a class="g-find" href="#' + L.overviewId + '" data-find>' + L.find + '</a>';
  }

  function setView(view, chapter, article) {
    root.setAttribute('data-view', view);
    chapters.forEach(function (c) { c.el.classList.toggle('is-current', c === chapter); });
    articles.forEach(function (a) { a.el.classList.toggle('is-current', a === article); });
    side.querySelectorAll('[aria-current]').forEach(function (e) { e.removeAttribute('aria-current'); });
    side.querySelectorAll('li.is-open').forEach(function (e) { e.classList.remove('is-open'); });
    if (!chapter) return;
    var li = side.querySelector('li[data-chapter="' + chapter.id + '"]');
    li.classList.add('is-open');
    var link = article && chapter.articles.length > 1 ? li.querySelector('a[href="#' + article.id + '"]') : li.firstChild;
    link.setAttribute('aria-current', 'page');
  }

  var firstRoute = true;
  var pendingTerms = null; /* Suchbegriffe des zuletzt geöffneten Treffers */
  function route() {
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ''; }
    var el = id ? document.getElementById(id) : null;
    var view = 'overview', chapter = null, article = null, target = null, heading, ttl;

    if (el && chapterById[id]) {
      chapter = chapterById[id];
      if (chapter.articles.length === 1) { article = chapter.articles[0]; view = 'article'; } else view = 'chapter';
    } else if (el && el.closest('article.topic')) {
      var art = el.closest('article.topic');
      article = articles.filter(function (a) { return a.el === art; })[0];
      chapter = article.chapter; view = 'article';
      if (el !== art) target = el;
    } else if (el && el !== overview && overview.contains(el)) {
      target = el;
    }

    setView(view, chapter, article);
    if (view === 'overview') {
      heading = overview.querySelector('h1'); ttl = TITLE + SUFFIX;
      crumbs.innerHTML = '';
    } else if (view === 'chapter') {
      heading = chapter.el.querySelector('.chapter-head h2'); ttl = chapter.title + ' – ' + TITLE + SUFFIX;
      crumbs.innerHTML = crumbHtml([{ text: TITLE, href: '#' + L.overviewId }, { text: chapter.title }]);
    } else {
      heading = article.el.querySelector('h2'); ttl = article.title + ' – ' + TITLE + SUFFIX;
      var items = [{ text: TITLE, href: '#' + L.overviewId }];
      if (chapter.articles.length > 1) items.push({ text: chapter.title, href: '#' + chapter.id });
      items.push({ text: article.title });
      crumbs.innerHTML = crumbHtml(items);
    }
    document.title = ttl;

    /* ?q= bleibt nur in der Übersicht in der Adresse */
    if (view !== 'overview' && location.search) history.replaceState(null, '', location.pathname + location.hash);

    /* Kommt man aus der Suche, die erste eingeklappte Stelle mit dem Suchbegriff aufklappen. */
    if (article && !target && pendingTerms) {
      [].some.call(article.el.querySelectorAll('details'), function (d) {
        var n = norm(d.textContent).s;
        if (pendingTerms.every(function (w) { return n.indexOf(w) !== -1; })) { d.open = true; target = d; return true; }
        return false;
      });
    }
    pendingTerms = null;
    function place() {
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    place();
    /* Beim ersten Laden springt der Browser nach dem Laden noch selbst zum Hash; danach erneut platzieren. */
    if (firstRoute && document.readyState !== 'complete') window.addEventListener('load', function () { setTimeout(place, 0); }, { once: true });

    if (!firstRoute || location.hash) {
      if (view === 'overview' && focusSearch) input.focus({ preventScroll: true });
      else if (heading) heading.focus({ preventScroll: true });
    }
    focusSearch = false;
    firstRoute = false;
  }

  document.addEventListener('click', function (e) {
    var hit = e.target.closest && e.target.closest('.g-results a');
    if (hit) pendingTerms = (hit.closest('.g-results').dataset.terms || '').split(' ').filter(Boolean);
    var a = e.target.closest && e.target.closest('a[data-find]');
    if (!a) return;
    focusSearch = true;
    if (location.hash === '#' + L.overviewId) route(); /* Hash ändert sich nicht, also kein hashchange */
  });
  window.addEventListener('hashchange', route);

  /* ?q=… füllt die Suche vor */
  var q = '';
  try { q = new URLSearchParams(location.search).get('q') || ''; } catch (e) { q = ''; }
  if (q) { input.value = q; input2.value = q; }
  route();
  if (q) { runMain(); input2.dispatchEvent(new Event('input')); }
})();
