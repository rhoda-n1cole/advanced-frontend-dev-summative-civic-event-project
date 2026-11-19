/**
 * layout.js – shared page chrome for every logged-in page:
 * header + navigation, global search, notification bell & drawer,
 * profile dropdown, footer, flash toasts.
 *
 * Usage on a page:  <body data-page="events"> ... <main id="main"> ... </main>
 * then call  Layout.init();  (after an Auth guard).
 */

/** Notification "read" state is kept on this device, per user,
 *  because the backend has no mark-as-read endpoint. */
const Notifs = {
  key() { return 'ce_read_' + (Auth.getUser()?.id || 'anon'); },
  readIds() { try { return JSON.parse(localStorage.getItem(Notifs.key())) || []; } catch { return []; } },
  isRead(n) { return n.read === true || Notifs.readIds().includes(n.id); },
  markRead(id) {
    const ids = new Set(Notifs.readIds()); ids.add(id);
    localStorage.setItem(Notifs.key(), JSON.stringify([...ids]));
  },
  markUnread(id) {
    localStorage.setItem(Notifs.key(), JSON.stringify(Notifs.readIds().filter(x => x !== id)));
  },
  /** Link to the related resource stored in metadata */
  linkFor(n) {
    const m = n.metadata || {};
    if (m.event_id) return `event.html?id=${encodeURIComponent(m.event_id)}`;
    if (m.promo_id) return `promo.html?id=${encodeURIComponent(m.promo_id)}`;
    if (m.announcement_id) return `announcement.html?id=${encodeURIComponent(m.announcement_id)}`;
    return '';
  },
  icon(type) {
    return { event: '📅', promo: '🎬', announcement: '📢', system: '⚙️' }[type] || '🔔';
  },
};

const Layout = {
  notifications: [],

  init() {
    const page = $('body').data('page');
    $('body').prepend(Layout.headerHtml(page));
    $('body').append(Layout.footerHtml());
    $('body').append(Layout.drawerHtml());
    Layout.bindEvents();
    Auth.applyRoleVisibility();
    UI.showFlash();
    Layout.loadNotifications();
    Layout.watchExpiry();
  },

  /** Sign the user out the moment the token expires (not only on the next API call) */
  watchExpiry() {
    const ms = Auth.msUntilExpiry();
    if (ms === null) return;
    if (ms > 60000) setTimeout(() => UI.toast('Your session will expire in 1 minute. Save your work.', 'info'), ms - 60000);
    setTimeout(() => Auth.logout('Your session has expired. Please log in again.'), Math.max(0, ms));
  },

  navLink(href, label, page, current, extra = '') {
    const active = page === current;
    return `<a href="${href}" ${extra} ${active ? 'aria-current="page"' : ''}
      class="rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white ${active ? 'bg-blue-900 text-white' : 'text-blue-50 hover:bg-blue-800'}">${label}</a>`;
  },

  headerHtml(current) {
    const user = Auth.getUser() || {};
    const initials = (user.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const links = [
      Layout.navLink('events.html', 'Events', 'events', current),
      Layout.navLink('announcements.html', 'Announcements', 'announcements', current),
      Layout.navLink('promos.html', 'Promos', 'promos', current),
      // ROLE GUARD (UI): admin links rendered with data-admin-only -> hidden for normal users
      Layout.navLink('admin-dashboard.html', 'Dashboard', 'dashboard', current, 'data-admin-only'),
      Layout.navLink('admin-users.html', 'Users', 'users', current, 'data-admin-only'),
      Layout.navLink('admin-notifications.html', 'Admin', 'admin-notifications', current, 'data-admin-only'),
    ].join('');

    return `
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-blue-800">Skip to main content</a>
    <header class="sticky top-0 z-40 bg-blue-700 shadow">
      <nav class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3" aria-label="Main">
        <a href="${Auth.homePage()}" class="flex items-center gap-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-extrabold text-blue-700" aria-hidden="true">CE</span>
          <span class="hidden text-lg font-bold sm:inline">CivicEvents</span>
        </a>

        <div class="hidden items-center gap-1 lg:flex" id="desktop-links">${links}</div>

        <form id="global-search" class="ml-auto hidden md:block" role="search">
          <label for="global-search-input" class="sr-only">Search events, announcements and promos</label>
          <input id="global-search-input" type="search" placeholder="Search…" value="${UI.esc(UI.param('q') || '')}"
            class="w-48 rounded-lg border-0 bg-blue-800 px-3 py-2 text-sm text-white placeholder-blue-200 focus:w-64 focus:outline-none focus:ring-2 focus:ring-white transition-all">
        </form>

        <button id="bell-btn" type="button" class="relative ml-auto rounded-lg p-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white md:ml-0"
          aria-label="Notifications" aria-haspopup="dialog" aria-controls="notif-drawer" aria-expanded="false">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"/></svg>
          <span id="bell-count" class="absolute -right-1 -top-1 hidden min-w-[1.25rem] rounded-full bg-amber-400 px-1 text-center text-xs font-bold text-slate-900"></span>
        </button>

        <div class="relative">
          <button id="profile-btn" type="button" class="flex items-center gap-2 rounded-lg p-1 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white"
            aria-haspopup="true" aria-expanded="false" aria-controls="profile-menu">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-700" aria-hidden="true">${UI.esc(initials)}</span>
            <span class="sr-only">Open profile menu for ${UI.esc(user.full_name || '')}</span>
          </button>
          <div id="profile-menu" class="absolute right-0 mt-2 hidden w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200" role="menu">
            <div class="border-b border-slate-100 px-4 py-3">
              <p class="truncate font-semibold text-slate-900">${UI.esc(user.full_name || '')}</p>
              <p class="truncate text-sm text-slate-600">${UI.esc(user.email || '')}</p>
              <span class="mt-1 inline-block rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'} px-2 py-0.5 text-xs font-semibold capitalize">${UI.esc(user.role || '')}</span>
            </div>
            <a href="dashboard.html" data-user-only role="menuitem" class="hidden block px-4 py-2 text-slate-800 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none">My dashboard</a>
            <a href="profile.html" role="menuitem" class="block px-4 py-2 text-slate-800 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none">My profile</a>
            <a href="my-registrations.html" role="menuitem" class="block px-4 py-2 text-slate-800 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none">My registrations</a>
            <a href="notifications.html" role="menuitem" class="block px-4 py-2 text-slate-800 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none">Notifications</a>
            <button id="logout-btn" type="button" role="menuitem" class="block w-full border-t border-slate-100 px-4 py-2 text-left text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none">Log out</button>
          </div>
        </div>

        <button id="menu-btn" type="button" class="rounded-lg p-2 text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white lg:hidden"
          aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </nav>
      <div id="mobile-menu" class="hidden border-t border-blue-600 px-4 pb-4 lg:hidden">
        <form class="mobile-search py-3" role="search">
          <label for="mobile-search-input" class="sr-only">Search</label>
          <input id="mobile-search-input" type="search" placeholder="Search…" class="w-full rounded-lg border-0 bg-blue-800 px-3 py-2 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white">
        </form>
        <div class="flex flex-col gap-1">${links}</div>
      </div>
    </header>`;
  },

  drawerHtml() {
    return `
    <div id="notif-overlay" class="fixed inset-0 z-50 hidden bg-slate-900/50"></div>
    <aside id="notif-drawer" role="dialog" aria-modal="true" aria-labelledby="notif-title"
      class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md translate-x-full flex-col bg-white shadow-2xl transition-transform duration-300" aria-hidden="true">
      <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 id="notif-title" class="text-lg font-bold text-slate-900">Notifications</h2>
        <div class="flex items-center gap-2">
          <button id="mark-all-read" type="button" class="rounded px-2 py-1 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-600">Mark all read</button>
          <button id="notif-close" type="button" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600" aria-label="Close notifications">✕</button>
        </div>
      </div>
      <ul id="notif-list" class="flex-1 divide-y divide-slate-100 overflow-y-auto" aria-live="polite"></ul>
      <a href="notifications.html" class="border-t border-slate-200 px-5 py-3 text-center font-medium text-blue-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600">View all notifications</a>
    </aside>`;
  },

  footerHtml() {
    return `
    <footer class="mt-16 bg-slate-900 text-slate-300">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p class="text-lg font-bold text-white">CivicEvents</p>
          <p class="mt-2 text-sm">Accessible city events, announcements and services for every resident.</p>
        </div>
        <nav aria-label="Footer">
          <p class="font-semibold text-white">Explore</p>
          <ul class="mt-2 space-y-1 text-sm">
            <li><a class="hover:text-white hover:underline" href="events.html">Events</a></li>
            <li><a class="hover:text-white hover:underline" href="announcements.html">Announcements</a></li>
            <li><a class="hover:text-white hover:underline" href="promos.html">Promos</a></li>
            <li><a class="hover:text-white hover:underline" href="my-registrations.html">My registrations</a></li>
          </ul>
        </nav>
        <div>
          <p class="font-semibold text-white">Contact &amp; help</p>
          <ul class="mt-2 space-y-1 text-sm">
            <li>Email: <a class="hover:text-white hover:underline" href="mailto:help@civicevents.city">help@civicevents.city</a></li>
            <li>Phone: <a class="hover:text-white hover:underline" href="tel:+27110000000">+27 11 000 0000</a></li>
            <li>Mon–Fri, 08:00–17:00</li>
          </ul>
        </div>
      </div>
      <p class="border-t border-slate-800 py-4 text-center text-xs">© ${new Date().getFullYear()} CivicEvents. All rights reserved.</p>
    </footer>`;
  },

  bindEvents() {
    // Global search -> events page with ?q=
    $('#global-search, .mobile-search').on('submit', function (e) {
      e.preventDefault();
      const q = $(this).find('input').val().trim();
      window.location.href = 'search.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    // Mobile menu
    $('#menu-btn').on('click', function () {
      const open = $('#mobile-menu').toggleClass('hidden').is(':visible');
      $(this).attr('aria-expanded', open);
    });

    // Profile dropdown
    $('#profile-btn').on('click', function (e) {
      e.stopPropagation();
      const open = $('#profile-menu').toggleClass('hidden').is(':visible');
      $(this).attr('aria-expanded', open);
      if (open) $('#profile-menu [role=menuitem]').first().trigger('focus');
    });
    $(document).on('click', () => { $('#profile-menu').addClass('hidden'); $('#profile-btn').attr('aria-expanded', false); });
    $('#profile-menu').on('keydown', e => {
      if (e.key === 'Escape') { $('#profile-menu').addClass('hidden'); $('#profile-btn').attr('aria-expanded', false).trigger('focus'); }
    });

    $('#logout-btn').on('click', () => { Auth.clear(); UI.flash('You have been logged out.', 'info'); window.location.href = 'login.html'; });

    // Notification drawer
    $('#bell-btn').on('click', Layout.openDrawer);
    $('#notif-close, #notif-overlay').on('click', Layout.closeDrawer);
    $(document).on('keydown', e => { if (e.key === 'Escape' && $('#notif-drawer').attr('aria-hidden') === 'false') Layout.closeDrawer(); });
    $('#mark-all-read').on('click', () => {
      Layout.notifications.forEach(n => Notifs.markRead(n.id));
      Layout.renderNotifications();
    });
    $('#notif-list').on('click', '.notif-item', function () {
      Notifs.markRead($(this).data('id')); // optimistic: mark read immediately
      Layout.renderNotifications();
    });
  },

  /**
   * Admin sidebar (left on desktop, horizontal scroll bar on mobile).
   * Only rendered on pages that already passed Auth.requireAdmin().
   */
  adminSidebar(current) {
    const item = (href, icon, label, key) => `
      <a href="${href}" ${key === current ? 'aria-current="page"' : ''}
        class="flex flex-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 ${key === current ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}">
        <span aria-hidden="true">${icon}</span>${label}</a>`;
    return `
      <aside class="lg:w-60 lg:flex-none" aria-label="Admin navigation">
        <nav class="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24 lg:flex-col">
          <p class="hidden px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500 lg:block">Admin</p>
          ${item('admin-dashboard.html', '📊', 'Dashboard', 'dashboard')}
          ${item('admin-users.html', '👥', 'Users', 'users')}
          ${item('admin-notifications.html', '🔔', 'Notifications', 'admin-notifications')}
          <p class="hidden px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-slate-500 lg:block">Create</p>
          ${item('event-form.html', '📅', 'New event', 'new-event')}
          ${item('announcement-form.html', '📢', 'New announcement', 'new-announcement')}
          ${item('promo-form.html', '🎬', 'New promo', 'new-promo')}
        </nav>
      </aside>`;
  },

  openDrawer() {
    $('#notif-overlay').removeClass('hidden');
    $('#notif-drawer').removeClass('translate-x-full').attr('aria-hidden', 'false');
    $('#bell-btn').attr('aria-expanded', true);
    setTimeout(() => $('#notif-close').trigger('focus'), 50);
    Layout.loadNotifications();
  },
  closeDrawer() {
    $('#notif-overlay').addClass('hidden');
    $('#notif-drawer').addClass('translate-x-full').attr('aria-hidden', 'true');
    $('#bell-btn').attr('aria-expanded', false).trigger('focus');
  },

  loadNotifications() {
    if (!Layout.notifications.length) $('#notif-list').html(`<li class="space-y-2 p-4">${UI.skeletonRows(4)}</li>`);
    return API.get('/api/notifications', { silent: true })
      .done(res => { Layout.notifications = res.data || []; Layout.renderNotifications(); })
      .fail(() => $('#notif-list').html('<li class="p-6 text-center text-slate-600">Could not load notifications.</li>'));
  },

  renderNotifications() {
    const list = Layout.notifications;
    const unread = list.filter(n => !Notifs.isRead(n)).length;
    $('#bell-count').text(unread > 99 ? '99+' : unread).toggleClass('hidden', unread === 0);
    $('#bell-btn').attr('aria-label', `Notifications, ${unread} unread`);

    if (!list.length) {
      $('#notif-list').html('<li class="p-8 text-center text-slate-600">You\'re all caught up. No notifications yet.</li>');
      return;
    }
    $('#notif-list').html(list.slice(0, 15).map(n => {
      const read = Notifs.isRead(n);
      const href = `notifications.html?id=${encodeURIComponent(n.id)}`;
      return `
        <li>
          <a href="${href}" data-id="${UI.esc(n.id)}" class="notif-item flex gap-3 px-5 py-4 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none ${read ? '' : 'bg-blue-50'}">
            <span class="text-xl" aria-hidden="true">${Notifs.icon(n.type)}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate font-semibold text-slate-900">${UI.esc(n.title)}</span>
                ${read ? '' : '<span class="h-2 w-2 flex-none rounded-full bg-blue-600"></span><span class="sr-only">(unread)</span>'}
              </span>
              <span class="mt-0.5 line-clamp-2 block text-sm text-slate-700">${UI.esc(n.message)}</span>
              <span class="mt-1 block text-xs text-slate-500">${UI.timeAgo(n.created_at)} · <span class="capitalize">${UI.esc(n.type)}</span></span>
            </span>
          </a>
        </li>`;
    }).join(''));
  },
};
