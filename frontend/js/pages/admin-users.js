/**
 * Users management – ADMIN ONLY (guarded in the HTML)
 *  GET   /api/users            list
 *  GET   /api/users/:id        view profile
 *  PATCH /api/users/:id/enable | /disable
 * Per the rules, there is NO way to change a user's role in the UI.
 */
$(function () {
  Layout.init();
  $('#sidebar').html(Layout.adminSidebar('users'));
  const me = Auth.getUser();
  let users = [];
  let lastFocus = null;

  load();
  function load() {
    $('#rows').html(`<tr><td colspan="5" class="p-4"><div class="space-y-2">${UI.skeletonRows(5)}</div></td></tr>`);
    API.get('/api/users?page=1&limit=500').done(res => { users = res.data || []; render(); })
      .fail(xhr => UI.errorState('#rows', 'Could not load users. ' + (xhr.friendlyMessage || ''), load));
  }

  function render() {
    const q = $('#search').val().trim().toLowerCase();
    const role = $('#f-role').val();
    const st = $('#f-status').val();
    const list = users.filter(u =>
      (!q || `${u.full_name} ${u.email}`.toLowerCase().includes(q)) &&
      (!role || u.role === role) &&
      (!st || (st === 'active' ? u.is_active : !u.is_active)));
    $('#count').text(`${list.length} of ${users.length} users`);
    if (!list.length) { $('#rows').html('<tr><td colspan="5" class="p-8 text-center text-slate-600">No users match your filters.</td></tr>'); return; }

    $('#rows').html(list.map(u => {
      const self = u.id === me.id;
      const initials = (u.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      return `
        <tr class="${u.is_active ? '' : 'bg-slate-50'}">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full ${u.is_active ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'} text-sm font-bold" aria-hidden="true">${UI.esc(initials)}</span>
              <div class="min-w-0">
                <p class="truncate font-semibold">${UI.esc(u.full_name)} ${self ? '<span class="text-xs font-normal text-slate-500">(you)</span>' : ''}</p>
                <p class="truncate text-slate-600">${UI.esc(u.email)}</p>
              </div>
            </div>
          </td>
          <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">${UI.esc(u.role)}</span></td>
          <td class="px-4 py-3 text-slate-600">${UI.formatDate(u.created_at, false)}</td>
          <td class="px-4 py-3">
            <!-- Accessible switch: enable / disable -->
            <button type="button" role="switch" aria-checked="${!!u.is_active}" data-switch="${UI.esc(u.id)}" ${self ? 'disabled title="You can\'t disable your own account"' : ''}
              aria-label="${u.is_active ? 'Disable' : 'Enable'} ${UI.esc(u.full_name)}"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${u.is_active ? 'bg-emerald-600' : 'bg-slate-300'}">
              <span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${u.is_active ? 'translate-x-5' : 'translate-x-0.5'}"></span>
            </button>
            <span class="ml-2 text-xs font-medium ${u.is_active ? 'text-emerald-700' : 'text-slate-600'}">${u.is_active ? 'Active' : 'Disabled'}</span>
          </td>
          <td class="px-4 py-3 text-right">
            <button type="button" data-view="${UI.esc(u.id)}" class="rounded-lg px-3 py-1.5 font-semibold text-blue-700 ring-1 ring-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600" aria-label="View ${UI.esc(u.full_name)}">View</button>
          </td>
        </tr>`;
    }).join(''));
  }

  $('#search, #f-role, #f-status').on('input change', render);

  // Enable / disable (optimistic UI, reverted on failure)
  $('#rows').on('click', '[data-switch]', function () {
    const u = users.find(x => x.id === String($(this).data('switch')));
    const enable = !u.is_active;
    const go = () => {
      u.is_active = enable;
      render();
      $(`[data-switch="${u.id}"]`).trigger('focus');
      API.patch(`/api/users/${encodeURIComponent(u.id)}/${enable ? 'enable' : 'disable'}`)
        .done(() => UI.toast(`${u.full_name} has been ${enable ? 'enabled' : 'disabled'}.`))
        .fail(() => { u.is_active = !enable; render(); });
    };
    if (enable) go();
    else UI.confirm(`Disable ${u.full_name}'s account? They will no longer be able to use CivicEvents.`, { confirmText: 'Disable account' }).then(ok => ok && go());
  });

  // View profile (GET /api/users/:id)
  $('#rows').on('click', '[data-view]', function () {
    lastFocus = this;
    $('#user-modal').removeClass('hidden').addClass('flex');
    $('#user-modal-body').html(UI.skeletonRows(3));
    $('#user-modal .close-modal').trigger('focus');
    API.get(`/api/users/${encodeURIComponent($(this).data('view'))}`).done(res => {
      const u = res.data;
      $('#user-modal-body').html(`
        <dl class="space-y-3">
          <div><dt class="text-sm font-semibold text-slate-600">Full name</dt><dd>${UI.esc(u.full_name)}</dd></div>
          <div><dt class="text-sm font-semibold text-slate-600">Email</dt><dd><a class="text-blue-700 hover:underline" href="mailto:${UI.esc(u.email)}">${UI.esc(u.email)}</a></dd></div>
          <div><dt class="text-sm font-semibold text-slate-600">Role</dt><dd class="capitalize">${UI.esc(u.role)} <span class="text-xs text-slate-500">(roles can't be changed here)</span></dd></div>
          <div><dt class="text-sm font-semibold text-slate-600">Status</dt><dd>${u.is_active ? 'Active' : 'Disabled'}</dd></div>
          <div><dt class="text-sm font-semibold text-slate-600">Joined</dt><dd>${UI.formatDate(u.created_at)}</dd></div>
          <div><dt class="text-sm font-semibold text-slate-600">Last updated</dt><dd>${UI.formatDate(u.updated_at)}</dd></div>
        </dl>`);
    }).fail(() => $('#user-modal-body').html('<p class="text-red-700">Could not load this user.</p>'));
  });
  const closeModal = () => { $('#user-modal').addClass('hidden').removeClass('flex'); lastFocus?.focus(); };
  $('#user-modal').on('click', e => { if (e.target.id === 'user-modal' || $(e.target).closest('.close-modal').length) closeModal(); });
  $(document).on('keydown', e => { if (e.key === 'Escape' && !$('#user-modal').hasClass('hidden')) closeModal(); });
});
