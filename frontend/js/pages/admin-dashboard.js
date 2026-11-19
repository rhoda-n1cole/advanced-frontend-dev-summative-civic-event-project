/**
 * Admin dashboard – GET /api/dashboard/admin (ADMIN ONLY, guarded in the HTML)
 * Stat cards + charts. Refreshes every 60s and when the tab becomes visible again,
 * so numbers update when data changes.
 */
$(function () {
  Layout.init();
  $('#sidebar').html(Layout.adminSidebar('dashboard'));
  const n = v => Number(v) || 0; // Postgres COUNT() comes back as a string

  load();
  setInterval(() => { if (!document.hidden) load(true); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
  $('#refresh').on('click', () => load());

  function load(quiet) {
    if (!quiet) $('#stats').html(Array(8).fill('<div class="h-28 animate-pulse rounded-2xl bg-slate-200" aria-hidden="true"></div>').join(''));
    $.when(API.get('/api/dashboard/admin', { silent: quiet }), API.get('/api/events', { silent: true }), API.get('/api/notifications', { silent: true }))
      .done((dash, ev, notifs) => {
        render(dash[0].data, ev[0].data || [], notifs[0].data || []);
        $('#updated').text('Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.');
      })
      .fail(xhr => { if (!quiet) UI.errorState('#stats', 'Could not load dashboard data. ' + (xhr.friendlyMessage || ''), () => load()); });
  }

  function render(d, events, notifications) {
    const unread = notifications.filter(x => !Notifs.isRead(x)).length;
    const cards = [
      { label: 'Total events', value: n(d.events?.total_events), sub: `${n(d.events?.upcoming_events)} upcoming`, icon: '📅', href: 'events.html' },
      { label: 'Registrations', value: n(d.registrations?.total_registrations), sub: 'all time', icon: '🎟️', href: 'events.html' },
      { label: 'Users', value: n(d.users?.total_users), sub: `${n(d.users?.active_users)} active`, icon: '👥', href: 'admin-users.html' },
      { label: 'Promos', value: n(d.promos?.total_promos), sub: 'videos', icon: '🎬', href: 'promos.html' },
      { label: 'Announcements', value: n(d.announcements?.total_announcements), sub: 'audio updates', icon: '📢', href: 'announcements.html' },
      { label: 'Feedback', value: n(d.feedbacks?.total_feedback), sub: 'reviews', icon: '⭐', href: 'events.html' },
      { label: 'Notifications', value: n(d.notifications?.total_notifications), sub: 'sent', icon: '🔔', href: 'admin-notifications.html' },
      { label: 'Unread (you)', value: unread, sub: 'notifications', icon: '📬', href: 'notifications.html' },
    ];
    $('#stats').html(cards.map(c => `
      <a href="${c.href}" class="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600">
        <div class="flex items-center justify-between"><p class="text-sm font-medium text-slate-600">${c.label}</p><span class="text-xl" aria-hidden="true">${c.icon}</span></div>
        <p class="mt-2 text-3xl font-bold tabular-nums">${c.value}</p>
        <p class="text-sm text-slate-500">${c.sub}</p>
      </a>`).join(''));

    Charts.bars('#chart-content', [
      { label: 'Events', value: n(d.events?.total_events) },
      { label: 'Registrations', value: n(d.registrations?.total_registrations) },
      { label: 'Feedback', value: n(d.feedbacks?.total_feedback) },
      { label: 'Announcements', value: n(d.announcements?.total_announcements) },
      { label: 'Promos', value: n(d.promos?.total_promos) },
      { label: 'Notifications', value: n(d.notifications?.total_notifications) },
    ], 'Content and engagement totals');

    // Fill in missing months so the chart always shows 6 columns
    const growth = {};
    (d.user_growth || []).forEach(g => { growth[g.month] = n(g.new_users); });
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      months.push({ label: dt.toLocaleString(undefined, { month: 'short' }), value: growth[key] || 0 });
    }
    Charts.columns('#chart-growth', months, 'New users per month');

    Charts.donut('#chart-users', [
      { label: 'Active', value: n(d.users?.active_users) },
      { label: 'Disabled', value: n(d.users?.inactive_users) },
    ], 'Active and disabled accounts');

    const next = events.filter(e => new Date(e.ends_at || e.starts_at) >= new Date())
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 5);
    $('#next-events').html(next.length ? next.map(e => `
      <li class="flex items-center justify-between gap-3 py-3">
        <div class="min-w-0">
          <a href="event.html?id=${encodeURIComponent(e.id)}" class="block truncate font-semibold hover:text-blue-700 hover:underline">${UI.esc(e.title)}</a>
          <p class="text-sm text-slate-600">${UI.formatDate(e.starts_at)} · ${UI.esc(e.location || '')}</p>
        </div>
        <a href="event-form.html?id=${encodeURIComponent(e.id)}" class="flex-none rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50" aria-label="Edit ${UI.esc(e.title)}">Edit</a>
      </li>`).join('') : '<li class="py-3 text-slate-600">No upcoming events. <a href="event-form.html" class="font-semibold text-blue-700 underline">Create one</a>.</li>');
  }
});
