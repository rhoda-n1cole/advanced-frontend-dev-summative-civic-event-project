/**
 * Announcements list – GET /api/announcements
 * Users see published only; admins see all and can publish/unpublish/edit/delete.
 * Each card can play its audio inline (one at a time).
 */
$(function () {
  Layout.init();
  let items = [];
  let page = 1;
  const PER = 8;
  const durations = {};      // id -> seconds (read from the audio file)
  const player = new Audio(); // shared inline player
  let playingId = null;

  $('#search').val(UI.param('q') || '');
  load();

  function load() {
    $('#list').html(UI.skeletonRows(5));
    Announcements.list().done(res => { items = res.data || []; render(); })
      .fail(xhr => UI.errorState('#list', 'Could not load announcements. ' + (xhr.friendlyMessage || ''), load));
  }

  function visible() {
    const q = $('#search').val().trim().toLowerCase();
    const st = $('#status').val();
    return items.filter(a => {
      if (!Auth.isAdmin() && a.published === false) return false; // ROLE GUARD (data)
      if (st === 'published' && a.published === false) return false;
      if (st === 'draft' && a.published !== false) return false;
      return !q || a.title.toLowerCase().includes(q);
    });
  }

  function render() {
    const list = visible();
    const pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    if (!list.length) {
      $('#list').html(`<li>${UI.emptyState(items.some(x => Auth.isAdmin() || x.published !== false) ? 'No announcements match your search' : 'No announcements yet', items.some(x => Auth.isAdmin() || x.published !== false) ? '' : 'New audio updates will appear here.')}</li>`);
      $('#pagination').empty();
      return;
    }
    $('#list').html(list.slice((page - 1) * PER, page * PER).map(row).join(''));
    Auth.applyRoleVisibility('#list');
    // Fill in lengths (the API doesn't store duration, so read it from each file)
    list.slice((page - 1) * PER, page * PER).forEach(a => {
      if (durations[a.id] !== undefined) return;
      AudioPlayer.duration(a.audio_url).done(d => {
        durations[a.id] = d;
        $(`[data-duration="${a.id}"]`).text(UI.formatDuration(d));
      }).fail(() => $(`[data-duration="${a.id}"]`).text('—'));
    });
    $('#pagination').html(pages > 1 ? Array.from({ length: pages }, (_, i) =>
      `<button type="button" data-page="${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''} aria-label="Page ${i + 1}"
        class="min-w-[2.5rem] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${i + 1 === page ? 'bg-blue-700 text-white' : 'bg-white ring-1 ring-slate-300 hover:bg-slate-50'}">${i + 1}</button>`).join('') : '');
  }

  function row(a) {
    const playing = playingId === a.id && !player.paused;
    const d = durations[a.id];
    return `
      <li class="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center">
        <button type="button" data-play="${UI.esc(a.id)}" class="flex h-12 w-12 flex-none items-center justify-center rounded-full ${playing ? 'bg-indigo-700' : 'bg-blue-700'} text-white shadow hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          aria-label="${playing ? 'Pause' : 'Play'} ${UI.esc(a.title)}" aria-pressed="${playing}">
          ${playing
            ? '<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
            : '<svg class="h-6 w-6 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'}
        </button>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <a href="announcement.html?id=${encodeURIComponent(a.id)}" class="font-bold hover:text-blue-700 hover:underline">${UI.esc(a.title)}</a>
            ${publishBadge(a.published)}
          </div>
          <p class="mt-1 text-sm text-slate-600">
            <span aria-hidden="true">⏱</span> <span class="sr-only">Length:</span> <span data-duration="${UI.esc(a.id)}">${d !== undefined ? UI.formatDuration(d) : '…'}</span>
            · <time datetime="${UI.esc(a.created_at)}">${UI.formatDate(a.created_at)}</time>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="announcement.html?id=${encodeURIComponent(a.id)}" class="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-700 hover:bg-blue-50">Open</a>
          <!-- ROLE GUARD (UI): admin-only controls -->
          <button type="button" data-admin-only data-toggle="${UI.esc(a.id)}" class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">${a.published === false ? 'Publish' : 'Unpublish'}</button>
          <a href="announcement-form.html?id=${encodeURIComponent(a.id)}" data-admin-only class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" aria-label="Edit ${UI.esc(a.title)}">Edit</a>
          <button type="button" data-admin-only data-delete="${UI.esc(a.id)}" class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50" aria-label="Delete ${UI.esc(a.title)}">Delete</button>
        </div>
      </li>`;
  }

  // Inline playback
  $('#list').on('click', '[data-play]', function () {
    const id = String($(this).data('play'));
    const a = items.find(x => x.id === id);
    if (playingId === id && !player.paused) { player.pause(); }
    else {
      if (playingId !== id) { player.src = a.audio_url; playingId = id; }
      player.play().catch(() => UI.toast('This audio could not be played. Open it to download instead.', 'error'));
    }
  });
  $(player).on('play pause ended', () => {
    const hadFocus = $(document.activeElement).is('[data-play]');
    render();
    if (hadFocus) $(`[data-play="${playingId}"]`).trigger('focus'); // keep keyboard focus on the button
  });

  $('#search, #status').on('input change', () => { page = 1; render(); });
  $('#pagination').on('click', '[data-page]', function () { page = Number($(this).data('page')); render(); });

  // Publish / unpublish (admin) – optimistic, reverts on failure
  $('#list').on('click', '[data-toggle]', function () {
    const a = items.find(x => x.id === String($(this).data('toggle')));
    const was = a.published;
    a.published = was === false;
    render();
    (was === false ? Announcements.publish(a.id) : Announcements.unpublish(a.id))
      .done(() => UI.toast(was === false ? 'Announcement published. Residents have been notified.' : 'Announcement unpublished.'))
      .fail(() => { a.published = was; render(); });
  });

  $('#list').on('click', '[data-delete]', function () {
    const a = items.find(x => x.id === String($(this).data('delete')));
    UI.confirm(`Delete "${a.title}"? This cannot be undone.`, { confirmText: 'Delete' }).then(ok => {
      if (!ok) return;
      Announcements.remove(a.id).done(() => {
        if (playingId === a.id) player.pause();
        items = items.filter(x => x !== a);
        UI.toast('Announcement deleted.');
        render();
      });
    });
  });
});
