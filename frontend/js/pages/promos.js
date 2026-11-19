/**
 * Promos list – GET /api/promos (cached in sessionStorage, see Promos.list in media-api.js)
 * Thumbnails: the API has no thumbnail field, so we lazy-load each video's first frame
 * only when the card scrolls into view (IntersectionObserver).
 */
$(function () {
  Layout.init();
  let items = [];

  $('#search').val(UI.param('q') || '');
  load(false);

  function load(fresh) {
    $('#grid').html(UI.skeletonCards(6));
    Promos.list(fresh).done(res => { items = res.data || []; render(); })
      .fail(xhr => UI.errorState('#grid', 'Could not load promos. ' + (xhr.friendlyMessage || ''), () => load(true)));
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const v = en.target;
      v.preload = 'metadata';
      v.src = v.dataset.src + '#t=1'; // show the frame at 1s as a thumbnail
      observer.unobserve(v);
    });
  }, { rootMargin: '200px' }) : null;

  function render() {
    const q = $('#search').val().trim().toLowerCase();
    const st = $('#status').val();
    const list = items.filter(p => {
      if (!Auth.isAdmin() && p.published === false) return false; // ROLE GUARD (data)
      if (st === 'published' && p.published === false) return false;
      if (st === 'draft' && p.published !== false) return false;
      return !q || `${p.title} ${p.description}`.toLowerCase().includes(q);
    });
    if (!list.length) {
      $('#grid').html(UI.emptyState(items.some(x => Auth.isAdmin() || x.published !== false) ? 'No promos match your search' : 'No promos yet', items.some(x => Auth.isAdmin() || x.published !== false) ? '' : 'Promo videos will appear here.'));
      return;
    }
    $('#grid').html(list.map(card).join(''));
    Auth.applyRoleVisibility('#grid');
    $('#grid video[data-src]').each(function () {
      if (observer) observer.observe(this); else { this.preload = 'metadata'; this.src = this.dataset.src + '#t=1'; }
    });
  }

  function card(p) {
    const desc = (p.description || '').length > 110 ? p.description.slice(0, 110) + '…' : (p.description || '');
    const href = `promo.html?id=${encodeURIComponent(p.id)}`;
    return `
      <article class="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
        <a href="${href}" class="group relative block aspect-video bg-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600" aria-label="Play ${UI.esc(p.title)}">
          <video data-src="${UI.esc(p.video_url)}" preload="none" muted playsinline class="h-full w-full object-cover" aria-hidden="true" tabindex="-1"></video>
          <span class="absolute inset-0 flex items-center justify-center bg-slate-900/30 transition group-hover:bg-slate-900/10">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-blue-800 shadow-lg transition group-hover:scale-110">
              <svg class="h-7 w-7 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            </span>
          </span>
          ${p.caption_text ? '<span class="absolute bottom-2 left-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs font-bold text-white">CC</span>' : ''}
        </a>
        <div class="flex flex-1 flex-col p-5">
          <div class="flex flex-wrap gap-2">${publishBadge(p.published)}</div>
          <h2 class="mt-1 text-lg font-bold"><a href="${href}" class="hover:text-blue-700 hover:underline">${UI.esc(p.title)}</a></h2>
          <p class="mt-2 flex-1 text-sm text-slate-600">${UI.esc(desc)}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <a href="${href}" class="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">▶ Play</a>
            <!-- ROLE GUARD (UI): admin-only controls -->
            <button type="button" data-admin-only data-toggle="${UI.esc(p.id)}" class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">${p.published === false ? 'Publish' : 'Unpublish'}</button>
            <a href="promo-form.html?id=${encodeURIComponent(p.id)}" data-admin-only class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" aria-label="Edit ${UI.esc(p.title)}">Edit</a>
            <button type="button" data-admin-only data-delete="${UI.esc(p.id)}" class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50" aria-label="Delete ${UI.esc(p.title)}">Delete</button>
          </div>
        </div>
      </article>`;
  }

  $('#search, #status').on('input change', render);
  $('#refresh').on('click', () => load(true));

  // Optimistic publish toggle – reverts if the API call fails
  $('#grid').on('click', '[data-toggle]', function () {
    const p = items.find(x => x.id === String($(this).data('toggle')));
    const was = p.published;
    p.published = was === false;
    render();
    (was === false ? Promos.publish(p.id) : Promos.unpublish(p.id))
      .done(() => UI.toast(was === false ? 'Promo published. Residents have been notified.' : 'Promo unpublished.'))
      .fail(() => { p.published = was; render(); });
  });

  $('#grid').on('click', '[data-delete]', function () {
    const p = items.find(x => x.id === String($(this).data('delete')));
    UI.confirm(`Delete "${p.title}"? This cannot be undone.`, { confirmText: 'Delete' }).then(ok => {
      if (ok) Promos.remove(p.id).done(() => { items = items.filter(x => x !== p); UI.toast('Promo deleted.'); render(); });
    });
  });
});
