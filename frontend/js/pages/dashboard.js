/**
 * My dashboard (normal users) – GET /api/dashboard/me
 * plus my registrations, latest announcements and events to discover.
 */
$(function () {
  Layout.init();
  const user = Auth.getUser() || {};
  $('#first-name').text((user.full_name || '').split(' ')[0] || 'there');
  const n = v => Number(v) || 0;

  $('#stats').html(Array(4).fill('<div class="h-24 animate-pulse rounded-2xl bg-slate-200" aria-hidden="true"></div>').join(''));
  ['#upcoming', '#latest-ann'].forEach(s => $(s).html(`<li class="space-y-2">${UI.skeletonRows(3)}</li>`));
  $('#discover').html(UI.skeletonCards(3));

  const now = new Date();
  $.when(
    API.get('/api/dashboard/me', { silent: true }).then(r => r.data || {}, () => ({})),
    Registrations.mine().then(r => r.data || [], () => []),
    API.get('/api/notifications', { silent: true }).then(r => r.data || [], () => []),
    Announcements.list(1, 5).then(r => r.data || [], () => []),
    API.get('/api/events', { silent: true }).then(r => r.data || [], () => [])
  ).done((stats, regs, notifs, anns, events) => {
    const active = regs.filter(r => r.status === 'registered');
    const upcoming = active.filter(r => new Date(r.ends_at || r.starts_at) >= now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const unread = notifs.filter(x => !Notifs.isRead(x)).length;

    const card = (label, value, icon, href) => `
      <a href="${href}" class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600">
        <div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-600">${label}</p><span aria-hidden="true">${icon}</span></div>
        <p class="mt-2 text-3xl font-bold tabular-nums">${value}</p>
      </a>`;
    $('#stats').html(
      card('Upcoming events', upcoming.length, '📅', 'my-registrations.html') +
      card('Registrations', n(stats.registrations?.total_registered_events) || active.length, '🎟️', 'my-registrations.html') +
      card('Reviews given', n(stats.feedbacks?.total_feedbacks), '⭐', 'my-registrations.html') +
      card('Unread notifications', unread, '🔔', 'notifications.html'));

    $('#upcoming').html(upcoming.length ? upcoming.slice(0, 5).map(r => `
      <li class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <a href="event.html?id=${encodeURIComponent(r.event_id)}" class="block truncate font-semibold hover:text-blue-700 hover:underline">${UI.esc(r.title)}</a>
          <p class="text-sm text-slate-600">${UI.formatDate(r.starts_at)} · ${UI.esc(r.location || '')}</p>
        </div>
        <span class="flex-none rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Registered</span>
      </li>`).join('') : '<li class="py-3 text-slate-600">You haven\'t registered for any upcoming events yet. <a class="font-semibold text-blue-700 underline" href="events.html">Find one</a>.</li>');

    const pubAnns = anns.filter(a => a.published !== false).slice(0, 4); // ROLE GUARD (data)
    $('#latest-ann').html(pubAnns.length ? pubAnns.map(a => `
      <li class="py-3"><a href="announcement.html?id=${encodeURIComponent(a.id)}" class="flex items-center gap-3 hover:text-blue-700">
        <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-blue-700 text-white" aria-hidden="true">▶</span>
        <span class="min-w-0"><span class="block truncate font-semibold">${UI.esc(a.title)}</span><span class="text-xs text-slate-500">${UI.timeAgo(a.created_at)}</span></span>
      </a></li>`).join('') : '<li class="py-3 text-slate-600">No announcements yet.</li>');

    const mine = new Set(active.map(r => r.event_id));
    const discover = events.filter(e => e.published !== false && !mine.has(e.id) && new Date(e.ends_at || e.starts_at) >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 3);
    $('#discover').html(discover.length ? discover.map(e => `
      <li class="overflow-hidden rounded-xl ring-1 ring-slate-200">
        ${e.metadata?.image_url ? `<img src="${UI.esc(e.metadata.image_url)}" alt="" loading="lazy" class="h-28 w-full object-cover bg-slate-200">` : '<div class="flex h-28 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl" aria-hidden="true">📅</div>'}
        <div class="p-4">
          <a href="event.html?id=${encodeURIComponent(e.id)}" class="font-semibold hover:text-blue-700 hover:underline">${UI.esc(e.title)}</a>
          <p class="mt-1 text-sm text-slate-600">${UI.formatDate(e.starts_at)}</p>
        </div>
      </li>`).join('') : '<li class="text-slate-600 sm:col-span-3">You\'re registered for everything coming up. 🎉</li>');
  });
});
