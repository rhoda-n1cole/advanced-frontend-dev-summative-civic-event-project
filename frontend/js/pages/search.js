/**
 * Global search – searches events, announcements and promos in one go.
 * Normal users only get published content (ROLE GUARD on the data).
 */
$(function () {
  Layout.init();
  const q0 = UI.param('q') || '';
  $('#q').val(q0);
  if (q0) run(q0); else $('#summary').text('Type something to search across the site.');

  $('#search-form').on('submit', e => {
    e.preventDefault();
    const q = $('#q').val().trim();
    history.replaceState(null, '', 'search.html' + (q ? '?q=' + encodeURIComponent(q) : ''));
    $('#global-search-input').val(q);
    if (q) run(q);
  });

  function run(q) {
    const term = q.toLowerCase();
    $('#summary').text('Searching…');
    $('#results').html(UI.skeletonRows(4));
    const match = (...fields) => fields.join(' ').toLowerCase().includes(term);
    const allowed = x => Auth.isAdmin() || x.published !== false;

    $.when(
      API.get('/api/events', { silent: true }).then(r => r.data || [], () => []),
      Announcements.list().then(r => r.data || [], () => []),
      Promos.list().then(r => r.data || [], () => [])
    ).done((events, anns, promos) => {
      const groups = [
        { title: 'Events', icon: '📅', items: events.filter(e => allowed(e) && match(e.title, e.description, e.location)).map(e => ({ href: `event.html?id=${encodeURIComponent(e.id)}`, title: e.title, sub: `${UI.formatDate(e.starts_at)} · ${e.location || ''}` })) },
        { title: 'Announcements', icon: '📢', items: anns.filter(a => allowed(a) && match(a.title)).map(a => ({ href: `announcement.html?id=${encodeURIComponent(a.id)}`, title: a.title, sub: UI.formatDate(a.created_at) })) },
        { title: 'Promos', icon: '🎬', items: promos.filter(p => allowed(p) && match(p.title, p.description, p.caption_text)).map(p => ({ href: `promo.html?id=${encodeURIComponent(p.id)}`, title: p.title, sub: p.description || '' })) },
      ];
      const total = groups.reduce((s, g) => s + g.items.length, 0);
      $('#summary').text(`${total} result${total === 1 ? '' : 's'} for "${q}"`);
      if (!total) { $('#results').html(UI.emptyState('No results', 'Try a different word, or browse events, announcements and promos from the menu.')); return; }
      $('#results').html(groups.filter(g => g.items.length).map(g => `
        <section aria-labelledby="g-${g.title}">
          <h2 id="g-${g.title}" class="text-lg font-bold"><span aria-hidden="true">${g.icon}</span> ${g.title} <span class="text-sm font-normal text-slate-500">(${g.items.length})</span></h2>
          <ul class="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            ${g.items.map(i => `<li><a href="${i.href}" class="block px-4 py-3 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"><span class="font-semibold text-blue-800">${UI.esc(i.title)}</span><span class="block truncate text-sm text-slate-600">${UI.esc(i.sub)}</span></a></li>`).join('')}
          </ul>
        </section>`).join(''));
    });
  }
});
