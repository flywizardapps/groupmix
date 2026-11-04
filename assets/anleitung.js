/* Anleitung: hebt den aktuellen Abschnitt in der Inhaltsübersicht hervor. Ohne JavaScript funktioniert alles, nur ohne Hervorhebung. */
(function () {
  var nav = document.querySelector('.guide-nav');
  if (!nav || !('IntersectionObserver' in window)) return;
  nav.classList.add('js');

  var wide = window.matchMedia('(min-width: 1100px)');
  var details = nav.querySelector('details');
  function syncOpen() { if (details) details.open = wide.matches; }
  syncOpen();
  if (wide.addEventListener) wide.addEventListener('change', syncOpen);

  var links = {};
  nav.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var targets = Array.prototype.slice.call(document.querySelectorAll('.guide-content section[id], .guide-content h3[id]'))
    .filter(function (el) { return links[el.id]; });
  var current = null;

  function update() {
    var limit = window.innerHeight * 0.3, found = null;
    targets.forEach(function (el) { if (el.getBoundingClientRect().top <= limit) found = el; });
    if (!found) found = targets[0];
    if (found === current) return;
    current = found;
    nav.querySelectorAll('[aria-current]').forEach(function (a) { a.removeAttribute('aria-current'); });
    nav.querySelectorAll('li.active').forEach(function (li) { li.classList.remove('active'); });
    links[found.id].setAttribute('aria-current', 'location');
    var chapter = found.closest('section[id]');
    var li = links[chapter.id] && links[chapter.id].closest('li');
    if (li) li.classList.add('active');
    var item = links[found.id].closest('li');
    if (item) item.classList.add('active');
  }

  var io = new IntersectionObserver(update, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
  targets.forEach(function (el) { io.observe(el); });
  window.addEventListener('scroll', update, { passive: true });
  update();
})();
