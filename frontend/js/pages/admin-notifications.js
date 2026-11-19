/**
 * Manage notifications – ADMIN ONLY (guarded in the HTML)
 *  GET    /api/notifications
 *  DELETE /api/notifications/:id   (single, bulk, or by ID via the form)
 */
$(function () {
  Layout.init();
  $('#sidebar').html(Layout.adminSidebar('admin-notifications'));
  let items = [];
  const selected = new Set();

  load();
  function load() {
    $('#rows').html(`<tr><td colspan="6" class="p-4"><div class="space-y-2">${UI.skeletonRows(5)}</div></td></tr>`);
    API.get('/api/notifications').done(res => { items = res.data || []; render(); })
      .fail(xhr => UI.errorState('#rows', 'Could not load notifications. ' + (xhr.friendlyMessage || ''), load));
  }

  function visible() {
    const q = $('#search').val().trim().toLowerCase();
    const t = $('#f-type').val();
    return items.filter(n => (!t || n.type === t) && (!q || `${n.title} ${n.message}`.toLowerCase().includes(q)));
  }

  function render() {
    const list = visible();
    $('#sel-count').text(selected.size);
    $('#bulk-delete').prop('disabled', !selected.size);
    $('#select-all').prop('checked', list.length > 0 && list.every(n => selected.has(n.id)));
    if (!list.length) { $('#rows').html('<tr><td colspan="6" class="p-8 text-center text-slate-600">No notifications.</td></tr>'); return; }
    $('#rows').html(list.map(n => `
      <tr>
        <td class="px-4 py-3"><input type="checkbox" data-select="${UI.esc(n.id)}" ${selected.has(n.id) ? 'checked' : ''} class="h-4 w-4 rounded border-slate-400 text-blue-700 focus:ring-blue-600" aria-label="Select ${UI.esc(n.title)}"></td>
        <td class="px-4 py-3">
          <p class="font-semibold">${UI.esc(n.title)}</p>
          <p class="max-w-md truncate text-slate-600">${UI.esc(n.message)}</p>
          <button type="button" data-copy="${UI.esc(n.id)}" class="mt-1 font-mono text-xs text-slate-500 hover:text-blue-700 hover:underline" aria-label="Copy notification ID">ID: ${UI.esc(n.id.slice(0, 8))}… (copy)</button>
        </td>
        <td class="px-4 py-3"><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">${Notifs.icon(n.type)} ${UI.esc(n.type)}</span></td>
        <td class="px-4 py-3 text-slate-700">${n.recipient_id ? 'One user' : 'Everyone'}</td>
        <td class="px-4 py-3 text-slate-600">${UI.timeAgo(n.created_at)}</td>
        <td class="px-4 py-3 text-right"><button type="button" data-delete="${UI.esc(n.id)}" class="rounded-lg px-3 py-1.5 font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600" aria-label="Delete ${UI.esc(n.title)}">Delete</button></td>
      </tr>`).join(''));
  }

  function removeIds(ids) {
    // Delete one by one; report how many succeeded
    const reqs = ids.map(id => API.del(`/api/notifications/${encodeURIComponent(id)}`, { silent: true })
      .then(() => ({ id, ok: true }), () => $.Deferred().resolve({ id, ok: false })));
    return $.when(...reqs).then((...results) => {
      const done = results.filter(r => r.ok).map(r => r.id);
      items = items.filter(n => !done.includes(n.id));
      done.forEach(id => selected.delete(id));
      Layout.notifications = Layout.notifications.filter(n => !done.includes(n.id));
      Layout.renderNotifications();
      render();
      return { done: done.length, failed: results.length - done.length };
    });
  }

  $('#search, #f-type').on('input change', render);
  $('#rows').on('change', '[data-select]', function () {
    const id = String($(this).data('select'));
    this.checked ? selected.add(id) : selected.delete(id);
    render();
  });
  $('#select-all').on('change', function () {
    visible().forEach(n => (this.checked ? selected.add(n.id) : selected.delete(n.id)));
    render();
  });
  $('#rows').on('click', '[data-copy]', function () {
    const id = String($(this).data('copy'));
    navigator.clipboard?.writeText(id).then(() => UI.toast('Notification ID copied.', 'info'), () => $('#notif-id').val(id));
    $('#notif-id').val(id);
  });

  $('#rows').on('click', '[data-delete]', function () {
    const n = items.find(x => x.id === String($(this).data('delete')));
    UI.confirm(`Delete "${n.title}" for everyone?`, { confirmText: 'Delete' }).then(ok => {
      if (ok) removeIds([n.id]).then(r => r.done ? UI.toast('Notification deleted.') : UI.toast('Could not delete that notification.', 'error'));
    });
  });

  $('#bulk-delete').on('click', () => {
    const ids = [...selected];
    UI.confirm(`Delete ${ids.length} notification${ids.length > 1 ? 's' : ''} for everyone?`, { confirmText: 'Delete all selected' }).then(ok => {
      if (!ok) return;
      UI.setLoading('#bulk-delete', true, 'Deleting…');
      removeIds(ids).then(r => {
        UI.setLoading('#bulk-delete', false);
        render();
        UI.toast(r.failed ? `${r.done} deleted, ${r.failed} failed.` : `${r.done} notification${r.done > 1 ? 's' : ''} deleted.`, r.failed ? 'error' : 'success');
      });
    });
  });

  // Delete-by-ID form (the "form in the Admin panel" from the brief)
  $('#delete-form').on('submit', function (e) {
    e.preventDefault();
    const id = $('#notif-id').val().trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) { UI.fieldError('#notif-id', 'Enter a full notification ID (36 characters). Use "copy" next to a notification to get it.'); return; }
    UI.fieldError('#notif-id', '');
    UI.confirm('Delete this notification for everyone?', { confirmText: 'Delete' }).then(ok => {
      if (!ok) return;
      UI.setLoading('#delete-id-btn', true, 'Deleting…');
      API.del(`/api/notifications/${encodeURIComponent(id)}`).done(() => {
        items = items.filter(n => n.id !== id);
        selected.delete(id);
        $('#notif-id').val('');
        render();
        Layout.notifications = Layout.notifications.filter(n => n.id !== id);
        Layout.renderNotifications();
        UI.toast('Notification deleted.');
      }).always(() => UI.setLoading('#delete-id-btn', false));
    });
  });
});
