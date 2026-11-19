/**
 * Notifications inbox – GET /api/notifications (broadcast + targeted to this user)
 * Detail view links to the related resource via metadata (event_id, promo_id, announcement_id).
 * "Read" state is kept per user on this device (optimistic; the API has no read endpoint).
 * Admins also get a Delete button (DELETE /api/notifications/:id).
 */
$(function () {
  Layout.init();
  let items = [];
  let selected = UI.param('id');

  load();
  function load() {
    $('#list').html(UI.skeletonRows(6));
    API.get('/api/notifications').done(res => {
      items = res.data || [];
      render();
      if (selected) show(selected);
    }).fail(xhr => UI.errorState('#list', 'Could not load notifications. ' + (xhr.friendlyMessage || ''), load));
  }

  function render() {
    const type = $('#f-type').val();
    const unreadOnly = $('#f-unread').is(':checked');
    const list = items.filter(n => (!type || n.type === type) && (!unreadOnly || !Notifs.isRead(n)));
    if (!list.length) {
      $('#list').html(`<li>${UI.emptyState(items.length ? 'Nothing here' : 'No notifications yet', items.length ? 'Try another filter.' : 'We\'ll let you know when something new is published.')}</li>`);
      return;
    }
    $('#list').html(list.map(n => {
      const read = Notifs.isRead(n);
      return `
        <li>
          <button type="button" data-id="${UI.esc(n.id)}" aria-current="${n.id === selected}"
            class="flex w-full gap-3 rounded-xl p-4 text-left ring-1 transition focus:outline-none focus:ring-2 focus:ring-blue-600 ${n.id === selected ? 'bg-blue-700 text-white ring-blue-700' : read ? 'bg-white ring-slate-200 hover:bg-slate-50' : 'bg-blue-50 ring-blue-200 hover:bg-blue-100'}">
            <span class="text-xl" aria-hidden="true">${Notifs.icon(n.type)}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate font-semibold">${UI.esc(n.title)}</span>
                ${read ? '' : `<span class="h-2 w-2 flex-none rounded-full ${n.id === selected ? 'bg-white' : 'bg-blue-600'}" aria-hidden="true"></span><span class="sr-only">(unread)</span>`}
              </span>
              <span class="mt-0.5 block truncate text-sm ${n.id === selected ? 'text-blue-100' : 'text-slate-600'}">${UI.esc(n.message)}</span>
              <span class="mt-1 block text-xs ${n.id === selected ? 'text-blue-100' : 'text-slate-500'}">${UI.timeAgo(n.created_at)} · <span class="capitalize">${UI.esc(n.type)}</span>${n.recipient_id ? ' · for you' : ' · everyone'}</span>
            </span>
          </button>
        </li>`;
    }).join(''));
  }

  function show(id) {
    const n = items.find(x => x.id === id);
    if (!n) { $('#detail').html('<p class="text-slate-600">This notification no longer exists.</p>'); return; }
    selected = id;
    Notifs.markRead(id);            // optimistic
    Layout.renderNotifications();   // keep the bell count in sync
    history.replaceState(null, '', `notifications.html?id=${encodeURIComponent(id)}`);
    const link = Notifs.linkFor(n);
    const linkLabel = { event: 'View event', promo: 'Watch promo', announcement: 'Listen to announcement' }[n.type] || 'Open';
    $('#detail').html(`
      <p class="text-3xl" aria-hidden="true">${Notifs.icon(n.type)}</p>
      <h2 class="mt-2 text-2xl font-bold" tabindex="-1" id="detail-title">${UI.esc(n.title)}</h2>
      <p class="mt-1 text-sm text-slate-600"><time datetime="${UI.esc(n.created_at)}">${UI.formatDate(n.created_at)}</time> · <span class="capitalize">${UI.esc(n.type)}</span> · ${n.recipient_id ? 'Sent to you' : 'Broadcast to everyone'}</p>
      <p class="mt-4 whitespace-pre-line leading-relaxed text-slate-800">${UI.esc(n.message)}</p>
      <div class="mt-6 flex flex-wrap gap-2">
        ${link ? `<a href="${link}" class="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">${linkLabel} →</a>` : ''}
        <button type="button" id="mark-unread" class="rounded-lg px-4 py-2 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Mark as unread</button>
        <!-- ROLE GUARD (UI): only admins can delete notifications -->
        <button type="button" id="delete" data-admin-only class="hidden rounded-lg px-4 py-2 font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Delete</button>
      </div>`);
    Auth.applyRoleVisibility('#detail');
    render();
  }

  $('#list').on('click', '[data-id]', function () {
    show(String($(this).data('id')));
    if (window.innerWidth < 1024) $('#detail')[0].scrollIntoView({ behavior: 'smooth' });
    $('#detail-title').trigger('focus');
  });
  $('#f-type, #f-unread').on('change', render);
  $('#mark-all').on('click', () => { items.forEach(n => Notifs.markRead(n.id)); render(); Layout.renderNotifications(); UI.toast('All notifications marked as read.'); });
  $('#detail').on('click', '#mark-unread', () => { Notifs.markUnread(selected); render(); Layout.renderNotifications(); UI.toast('Marked as unread.', 'info'); });

  $('#detail').on('click', '#delete', () => {
    UI.confirm('Delete this notification for everyone?', { confirmText: 'Delete' }).then(ok => {
      if (!ok) return;
      API.del(`/api/notifications/${encodeURIComponent(selected)}`).done(() => {
        items = items.filter(n => n.id !== selected);
        Layout.notifications = Layout.notifications.filter(n => n.id !== selected);
        Layout.renderNotifications();
        selected = null;
        history.replaceState(null, '', 'notifications.html');
        $('#detail').html('<p class="text-slate-600">Notification deleted. Select another one to read it.</p>');
        render();
        UI.toast('Notification deleted.');
      });
    });
  });
});
