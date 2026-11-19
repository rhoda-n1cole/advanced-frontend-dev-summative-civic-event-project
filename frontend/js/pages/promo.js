/**
 * Promo detail – GET /api/promos/:id
 * HTML5 <video> (native play/pause, volume, fullscreen) with a captions <track>
 * that is ON by default, a captions toggle button, and a full transcript.
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  if (!id) { window.location.replace('promos.html'); return; }
  let p = null;

  load();
  function load() {
    Promos.get(id).done(res => {
      p = res.data;
      // ROLE GUARD (data): normal users cannot open unpublished promos
      if (!Auth.isAdmin() && p.published === false) {
        $('#content').html(UI.emptyState('This promo is not available', 'It may have been unpublished.'));
        return;
      }
      document.title = `${p.title} · CivicEvents`;
      render();
    }).fail(xhr => xhr.status === 404
      ? $('#content').html(UI.emptyState('Promo not found', 'It may have been removed.', '<a class="font-semibold text-blue-700 underline" href="promos.html">Back to promos</a>'))
      : UI.errorState('#content', 'Could not load this promo.', load));
  }

  function render() {
    $('#content').html(`
      <article>
        <div class="overflow-hidden rounded-2xl bg-black shadow-lg">
          <video id="video" controls playsinline preload="metadata" class="aspect-video w-full bg-black" aria-label="${UI.esc(p.title)}">
            <source src="${UI.esc(p.video_url)}">
            Your browser can't play this video. <a href="${UI.esc(p.video_url)}" class="underline">Download it</a> instead.
          </video>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button id="cc-btn" type="button" aria-pressed="true" class="${p.caption_text ? '' : 'hidden'} rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600">CC Captions: On</button>
          <a href="${UI.esc(p.video_url)}" download class="rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-700 hover:bg-blue-50">Download video</a>
          <p id="video-error" class="hidden text-sm font-medium text-red-700" role="alert">This video couldn't be played in your browser. Try downloading it.</p>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-2">${publishBadge(p.published)}</div>
        <h1 class="mt-1 text-3xl font-bold">${UI.esc(p.title)}</h1>
        <p class="mt-1 text-sm text-slate-600">Added <time datetime="${UI.esc(p.created_at)}">${UI.formatDate(p.created_at, false)}</time></p>
        <p class="mt-4 whitespace-pre-line leading-relaxed text-slate-700">${UI.esc(p.description || '')}</p>

        <details class="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" ${p.caption_text ? 'open' : ''}>
          <summary class="cursor-pointer text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 rounded">Transcript</summary>
          <p class="mt-3 whitespace-pre-line text-slate-700">${p.caption_text ? UI.esc(p.caption_text.replace(/^WEBVTT[\s\S]*?\n\n/, '').replace(/^\d+\n[\d:.]+ --> [\d:.]+\n/gm, '')) : 'No transcript is available for this video.'}</p>
        </details>

        <!-- ROLE GUARD (UI): admin-only controls -->
        <div data-admin-only class="hidden mt-6 flex flex-wrap gap-3">
          <a href="promo-form.html?id=${encodeURIComponent(p.id)}" class="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">Edit</a>
          <button id="toggle" type="button" class="rounded-lg px-5 py-2.5 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">${p.published === false ? 'Publish' : 'Unpublish'}</button>
          <button id="delete" type="button" class="rounded-lg px-5 py-2.5 font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Delete</button>
        </div>
      </article>`);
    Auth.applyRoleVisibility('#content');

    const video = document.getElementById('video');
    $(video).on('error', () => $('#video-error').removeClass('hidden'));
    $(video).find('source').on('error', () => $('#video-error').removeClass('hidden'));

    // Build the captions track once we know the video length
    const addTrack = () => {
      if (!p.caption_text || video.querySelector('track')) return;
      const track = document.createElement('track');
      Object.assign(track, { kind: 'captions', srclang: 'en', label: 'English', default: true, src: Promos.captionsUrl(p.caption_text, video.duration) });
      video.appendChild(track);
      track.track.mode = 'showing'; // captions ON by default
    };
    if (video.readyState >= 1) addTrack(); else $(video).one('loadedmetadata', addTrack);
    // If metadata never loads (e.g. slow network), still add captions after 3s
    setTimeout(addTrack, 3000);
  }

  $('#content').on('click', '#cc-btn', function () {
    const t = document.querySelector('#video').textTracks[0];
    if (!t) return;
    const on = t.mode !== 'showing';
    t.mode = on ? 'showing' : 'hidden';
    $(this).attr('aria-pressed', on).text(`CC Captions: ${on ? 'On' : 'Off'}`)
      .toggleClass('bg-slate-900 text-white', on).toggleClass('bg-white text-slate-900 ring-1 ring-slate-400', !on);
  });

  $('#content').on('click', '#toggle', function () {
    UI.setLoading(this, true, 'Saving…');
    (p.published === false ? Promos.publish(id) : Promos.unpublish(id))
      .done(res => { p = res.data; UI.toast(p.published ? 'Published. Residents have been notified.' : 'Unpublished.'); render(); })
      .fail(() => UI.setLoading(this, false));
  });
  $('#content').on('click', '#delete', () => {
    UI.confirm(`Delete "${p.title}"? This cannot be undone.`, { confirmText: 'Delete' }).then(ok => {
      if (ok) Promos.remove(id).done(() => { UI.flash('Promo deleted.'); window.location.href = 'promos.html'; });
    });
  });
});
