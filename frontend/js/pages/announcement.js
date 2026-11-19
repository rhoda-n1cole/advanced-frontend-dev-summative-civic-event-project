/**
 * Announcement detail – GET /api/announcements/:id
 * Accessible audio player + transcript (if the API provides one).
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  if (!id) { window.location.replace('announcements.html'); return; }
  let a = null;

  load();
  function load() {
    Announcements.get(id).done(res => {
      a = res.data;
      // ROLE GUARD (data): normal users cannot open unpublished announcements
      if (!Auth.isAdmin() && a.published === false) {
        $('#content').html(UI.emptyState('This announcement is not available', 'It may have been unpublished.'));
        return;
      }
      document.title = `${a.title} · CivicEvents`;
      render();
    }).fail(xhr => xhr.status === 404
      ? $('#content').html(UI.emptyState('Announcement not found', 'It may have been removed.', '<a class="font-semibold text-blue-700 underline" href="announcements.html">Back to announcements</a>'))
      : UI.errorState('#content', 'Could not load this announcement.', load));
  }

  function render() {
    $('#content').html(`
      <article>
        <div class="flex flex-wrap items-center gap-2">${publishBadge(a.published)}</div>
        <h1 class="mt-2 text-3xl font-bold">${UI.esc(a.title)}</h1>
        <p class="mt-1 text-slate-600">Posted <time datetime="${UI.esc(a.created_at)}">${UI.formatDate(a.created_at)}</time></p>
        <div id="player" class="mt-6"></div>
        <p class="mt-2 text-sm text-slate-600">Keyboard: <kbd class="rounded bg-slate-200 px-1">Space</kbd> play/pause, <kbd class="rounded bg-slate-200 px-1">←</kbd>/<kbd class="rounded bg-slate-200 px-1">→</kbd> skip 5 seconds.</p>

        <section class="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="transcript-title">
          <h2 id="transcript-title" class="text-lg font-bold">Transcript</h2>
          <p class="mt-2 whitespace-pre-line text-slate-700">${a.transcript
            ? UI.esc(a.transcript)
            : 'A written transcript is not available for this announcement yet. Need it in another format? Email <a class="text-blue-700 underline" href="mailto:help@civicevents.city">help@civicevents.city</a>.'}</p>
        </section>

        <!-- ROLE GUARD (UI): admin-only controls -->
        <div data-admin-only class="hidden mt-6 flex flex-wrap gap-3">
          <a href="announcement-form.html?id=${encodeURIComponent(a.id)}" class="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">Edit</a>
          <button id="toggle" type="button" class="rounded-lg px-5 py-2.5 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600">${a.published === false ? 'Publish' : 'Unpublish'}</button>
          <button id="delete" type="button" class="rounded-lg px-5 py-2.5 font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600">Delete</button>
        </div>
      </article>`);
    AudioPlayer.mount('#player', { src: a.audio_url, title: a.title });
    Auth.applyRoleVisibility('#content');
  }

  $('#content').on('click', '#toggle', function () {
    UI.setLoading(this, true, 'Saving…');
    (a.published === false ? Announcements.publish(id) : Announcements.unpublish(id))
      .done(res => { a = res.data; UI.toast(a.published ? 'Published. Residents have been notified.' : 'Unpublished.'); render(); })
      .fail(() => UI.setLoading(this, false));
  });
  $('#content').on('click', '#delete', () => {
    UI.confirm(`Delete "${a.title}"? This cannot be undone.`, { confirmText: 'Delete' }).then(ok => {
      if (ok) Announcements.remove(id).done(() => { UI.flash('Announcement deleted.'); window.location.href = 'announcements.html'; });
    });
  });
});
