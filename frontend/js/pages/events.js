/**
 * Events list page – GET /api/events
 * - Normal users only see published events; admins see all (with a status badge)
 * - Client-side search, date and location filters + pagination
 *   (the API returns every event in one response, so we paginate in the browser)
 */
$(function () {
  Layout.init();

  const state = {
    events: [],
    myRegs: new Set(), // event ids the current user is registered for
    page: 1,
  };

  // Pre-fill search from the global search bar (?q=)
  $('#f-search').val(UI.param('q') || '');

  load();

  function load() {
    $('#events-grid').attr('aria-busy', 'true').html(UI.skeletonCards(6));
    $('#pagination').empty();

    const requests = [API.get('/api/events', { silent: true })];
    // Normal users: also load their registrations so cards can show Register / Cancel
    if (!Auth.isAdmin()) requests.push(API.get('/api/event-registrations/my-registrations', { silent: true }));

    $.when(...requests)
      .done((eventsRes, regsRes) => {
        // $.when with several requests gives [data, status, xhr] arrays
        const evBody = requests.length > 1 ? eventsRes[0] : eventsRes;
        state.events = evBody.data || [];
        if (regsRes) {
          state.myRegs = new Set((regsRes[0].data || []).filter(r => r.status === 'registered').map(r => r.event_id));
        }
        fillLocations();
        render();
      })
      .fail(xhr => UI.errorState('#events-grid', 'We couldn\'t load events. ' + (xhr.friendlyMessage || ''), load))
      .always(() => $('#events-grid').attr('aria-busy', 'false'));
  }

  function fillLocations() {
    const current = $('#f-location').val();
    const locations = [...new Set(state.events.map(e => (e.location || '').trim()).filter(Boolean))].sort();
    $('#f-location').html('<option value="">All locations</option>' +
      locations.map(l => `<option value="${UI.esc(l)}">${UI.esc(l)}</option>`).join('')).val(current);
  }

  function filtered() {
    const q = $('#f-search').val().trim().toLowerCase();
    const when = $('#f-when').val();
    const day = $('#f-date').val();
    const loc = $('#f-location').val();
    const status = $('#f-status').val();
    const now = new Date();
    const inDays = d => new Date(now.getTime() + d * 86400000);

    return state.events.filter(e => {
      // ROLE GUARD (data): normal users never see unpublished events
      if (!Auth.isAdmin() && e.published === false) return false;
      if (status === 'published' && e.published === false) return false;
      if (status === 'draft' && e.published !== false) return false;

      if (q && !`${e.title} ${e.description} ${e.location}`.toLowerCase().includes(q)) return false;
      if (loc && (e.location || '').trim() !== loc) return false;

      const start = new Date(e.starts_at);
      const end = new Date(e.ends_at || e.starts_at);
      if (when === 'upcoming' && end < now) return false;
      if (when === 'past' && end >= now) return false;
      if (when === 'week' && (end < now || start > inDays(7))) return false;
      if (when === 'month' && (end < now || start > inDays(30))) return false;
      if (when === 'date' && day) {
        const d0 = new Date(day + 'T00:00'), d1 = new Date(day + 'T23:59:59');
        if (end < d0 || start > d1) return false;
      }
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / CONFIG.PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const slice = list.slice((state.page - 1) * CONFIG.PAGE_SIZE, state.page * CONFIG.PAGE_SIZE);

    const filtersActive = $('#f-search').val() || $('#f-location').val() || $('#f-when').val() !== 'upcoming' || $('#f-status').val();
    $('#clear-filters').toggleClass('hidden', !filtersActive);
    $('#result-count').text(`${list.length} event${list.length === 1 ? '' : 's'} found`);

    if (!list.length) {
      $('#events-grid').html(UI.emptyState(
        state.events.length ? 'No events match your filters' : 'No events yet',
        state.events.length ? 'Try a different search, date or location.' : 'Check back soon for new city events.',
        Auth.isAdmin() && !state.events.length ? '<a href="event-form.html" class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Create the first event</a>' : ''
      ));
      $('#pagination').empty();
      return;
    }

    $('#events-grid').html(slice.map(card).join(''));
    Auth.applyRoleVisibility('#events-grid');
    renderPagination(pages);
  }

  function card(e) {
    const img = e.metadata?.image_url;
    const registered = state.myRegs.has(e.id);
    const past = new Date(e.ends_at || e.starts_at) < new Date();
    const desc = (e.description || '').length > 120 ? e.description.slice(0, 120) + '…' : (e.description || '');
    return `
      <article class="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
        <a href="event.html?id=${encodeURIComponent(e.id)}" class="block focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600" tabindex="-1" aria-hidden="true">
          ${img
            ? `<img src="${UI.esc(img)}" alt="" loading="lazy" class="h-44 w-full object-cover bg-slate-200" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'h-44 bg-gradient-to-br from-blue-600 to-indigo-700'}))">`
            : '<div class="flex h-44 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-5xl" aria-hidden="true">📅</div>'}
        </a>
        <div class="flex flex-1 flex-col p-5">
          <div class="flex flex-wrap gap-2">
            ${e.published === false ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unpublished</span>' : ''}
            ${registered ? '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ You\'re registered</span>' : ''}
            ${past ? '<span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Ended</span>' : ''}
          </div>
          <h2 class="mt-2 text-lg font-bold leading-snug">
            <a href="event.html?id=${encodeURIComponent(e.id)}" class="hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600 rounded">${UI.esc(e.title)}</a>
          </h2>
          <p class="mt-2 text-sm text-slate-700"><span aria-hidden="true">🕒</span> <time datetime="${UI.esc(e.starts_at)}">${UI.formatDate(e.starts_at)}</time></p>
          <p class="mt-1 text-sm text-slate-700"><span aria-hidden="true">📍</span> ${UI.esc(e.location || 'Location to be announced')}</p>
          <p class="mt-3 flex-1 text-sm text-slate-600">${UI.esc(desc)}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <a href="event.html?id=${encodeURIComponent(e.id)}" class="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600" aria-label="View ${UI.esc(e.title)}">View</a>
            ${past ? '' : `
            <!-- ROLE GUARD (UI): register/cancel only for normal users -->
            <button type="button" data-user-only data-reg="${UI.esc(e.id)}" data-registered="${registered}"
              class="reg-btn hidden rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 ${registered ? 'bg-white text-red-700 ring-1 ring-red-700 hover:bg-red-50 focus:ring-red-600' : 'bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-600'}"
              aria-label="${registered ? 'Cancel registration for' : 'Register for'} ${UI.esc(e.title)}">${registered ? 'Cancel registration' : 'Register'}</button>`}
            <!-- ROLE GUARD (UI): edit/delete only for admins -->
            <a href="event-form.html?id=${encodeURIComponent(e.id)}" data-admin-only class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600" aria-label="Edit ${UI.esc(e.title)}">Edit</a>
            <button type="button" data-admin-only data-delete="${UI.esc(e.id)}" class="hidden rounded-lg px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600" aria-label="Delete ${UI.esc(e.title)}">Delete</button>
          </div>
        </div>
      </article>`;
  }

  function renderPagination(pages) {
    if (pages <= 1) { $('#pagination').empty(); return; }
    const btn = (label, page, { disabled = false, current = false, aria = '' } = {}) =>
      `<button type="button" data-page="${page}" ${disabled ? 'disabled' : ''} ${current ? 'aria-current="page"' : ''} ${aria ? `aria-label="${aria}"` : ''}
        class="min-w-[2.5rem] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${current ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'}">${label}</button>`;
    let html = btn('‹ Prev', state.page - 1, { disabled: state.page === 1, aria: 'Previous page' });
    for (let p = 1; p <= pages; p++) html += btn(p, p, { current: p === state.page, aria: `Page ${p}` });
    html += btn('Next ›', state.page + 1, { disabled: state.page === pages, aria: 'Next page' });
    $('#pagination').html(html);
  }

  // ----- events -----
  $('#filters').on('input change', 'input, select', function () {
    $('#f-date-wrap').toggleClass('hidden', $('#f-when').val() !== 'date');
    state.page = 1;
    render();
  });
  $('#filters').on('submit', e => e.preventDefault());

  $('#clear-filters').on('click', () => {
    $('#f-search').val(''); $('#f-location').val(''); $('#f-when').val('upcoming'); $('#f-status').val(''); $('#f-date').val('');
    $('#f-date-wrap').addClass('hidden');
    state.page = 1; render();
  });

  $('#pagination').on('click', 'button[data-page]', function () {
    state.page = Number($(this).data('page'));
    render();
    $('#main')[0].scrollIntoView({ behavior: 'smooth' });
  });

  // Register / cancel (normal users)
  $('#events-grid').on('click', '.reg-btn', function () {
    const $b = $(this);
    const id = String($b.data('reg'));
    const registered = $b.attr('data-registered') === 'true';
    if (registered) {
      UI.confirm('Cancel your registration for this event?', { confirmText: 'Yes, cancel' }).then(ok => {
        if (!ok) return;
        UI.setLoading($b, true, 'Cancelling…');
        Registrations.cancel(id)
          .done(() => { state.myRegs.delete(id); UI.toast('Your registration was cancelled.', 'info'); render(); })
          .fail(() => UI.setLoading($b, false));
      });
    } else {
      UI.setLoading($b, true, 'Registering…');
      Registrations.register(id)
        .done(() => { state.myRegs.add(id); UI.toast('You\'re registered! See it under My registrations.'); render(); })
        .fail(() => UI.setLoading($b, false));
    }
  });

  // Delete (admins)
  $('#events-grid').on('click', '[data-delete]', function () {
    const id = String($(this).data('delete'));
    const ev = state.events.find(e => e.id === id);
    UI.confirm(`Delete "${ev?.title}"? This cannot be undone.`, { confirmText: 'Delete event' }).then(ok => {
      if (!ok) return;
      EventsApi.remove(id).done(() => {
        state.events = state.events.filter(e => e.id !== id);
        UI.toast('Event deleted.');
        fillLocations(); render();
      });
    });
  });
});
