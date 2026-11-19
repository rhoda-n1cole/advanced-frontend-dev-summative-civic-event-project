/**
 * My registrations – GET /api/event-registrations/my-registrations
 * Lets the user cancel (POST /api/event-registrations/cancel).
 */
$(function () {
  Layout.init();
  let regs = [];
  let tab = 'upcoming';

  load();

  function load() {
    $('#regs').html(UI.skeletonRows(4));
    Registrations.mine().done(res => { regs = res.data || []; render(); })
      .fail(xhr => UI.errorState('#regs', 'Could not load your registrations. ' + (xhr.friendlyMessage || ''), load));
  }

  function render() {
    $('.tab').each(function () {
      const on = $(this).data('tab') === tab;
      $(this).attr('aria-selected', on)
        .toggleClass('bg-blue-700 text-white', on)
        .toggleClass('bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50', !on);
    });
    const now = new Date();
    const list = regs.filter(r => {
      if (tab === 'cancelled') return r.status === 'cancelled';
      if (r.status !== 'registered') return false;
      const ended = new Date(r.ends_at || r.starts_at) < now;
      return tab === 'past' ? ended : !ended;
    }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

    if (!list.length) {
      const msg = { upcoming: ['No upcoming events', 'Browse events and register for something you like.'],
                    past: ['No past events yet', ''], cancelled: ['No cancelled registrations', ''] }[tab];
      $('#regs').html(`<li>${UI.emptyState(msg[0], msg[1], tab === 'upcoming' ? '<a href="events.html" class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Browse events</a>' : '')}</li>`);
      return;
    }

    $('#regs').html(list.map(r => `
      <li class="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a href="event.html?id=${encodeURIComponent(r.event_id)}" class="text-lg font-bold hover:text-blue-700 hover:underline">${UI.esc(r.title)}</a>
          <p class="mt-1 text-sm text-slate-700"><span aria-hidden="true">🕒</span> ${UI.formatDate(r.starts_at)} · <span aria-hidden="true">📍</span> ${UI.esc(r.location || '')}</p>
          <p class="mt-1 text-xs text-slate-500">Registered ${UI.formatDate(r.created_at, false)}</p>
        </div>
        <div class="flex gap-2">
          <a href="event.html?id=${encodeURIComponent(r.event_id)}" class="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-700 hover:bg-blue-50">View</a>
          ${tab === 'upcoming' ? `<button type="button" data-cancel="${UI.esc(r.event_id)}" class="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600" aria-label="Cancel registration for ${UI.esc(r.title)}">Cancel</button>` : ''}
          ${tab === 'past' ? `<a href="event.html?id=${encodeURIComponent(r.event_id)}#feedback-section" class="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">Leave feedback</a>` : ''}
        </div>
      </li>`).join(''));
  }

  $('.tab').on('click', function () { tab = $(this).data('tab'); render(); });

  $('#regs').on('click', '[data-cancel]', function () {
    const eventId = String($(this).data('cancel'));
    const reg = regs.find(r => r.event_id === eventId);
    UI.confirm(`Cancel your registration for "${reg?.title}"?`, { confirmText: 'Yes, cancel' }).then(ok => {
      if (!ok) return;
      // Optimistic UI: move it to "cancelled" straight away, revert if the API fails
      const prev = reg.status;
      reg.status = 'cancelled';
      render();
      Registrations.cancel(eventId)
        .done(() => UI.toast('Registration cancelled.', 'info'))
        .fail(() => { reg.status = prev; render(); });
    });
  });
});
