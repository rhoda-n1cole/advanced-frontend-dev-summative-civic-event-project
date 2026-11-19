/**
 * My profile – GET/PATCH /api/users/profile/me
 * Users can change full_name and email only. role and is_active are shown read-only
 * and are NEVER sent (the backend also rejects them).
 */
$(function () {
  Layout.init();
  let user = null;

  load();
  function load() {
    API.get('/api/users/profile/me').done(res => { user = res.data; fill(); }).fail(() => UI.errorState('#profile-form', 'Could not load your profile.', load));
    API.get('/api/dashboard/me', { silent: true }).done(res => {
      const d = res.data || {};
      const stat = (label, v, href) => `<div class="rounded-xl bg-slate-50 p-3"><dt class="text-xs font-semibold text-slate-600">${label}</dt><dd class="text-2xl font-bold"><a href="${href}" class="hover:text-blue-700">${Number(v) || 0}</a></dd></div>`;
      $('#my-stats').html(
        stat('Registrations', d.registrations?.total_registered_events, 'my-registrations.html') +
        stat('Reviews', d.feedbacks?.total_feedbacks, 'my-registrations.html'));
    });
  }

  function fill() {
    const initials = (user.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    $('#avatar').text(initials);
    $('#who').text(user.full_name);
    $('#who-email').text(user.email);
    $('#badges').html(`
      <span class="rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">${UI.esc(user.role)}</span>
      <span class="rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${user.is_active ? 'Active' : 'Disabled'}</span>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Joined ${UI.formatDate(user.created_at, false)}</span>`);
    $('#full_name').val(user.full_name);
    $('#email').val(user.email);
    $('#role').val(user.role);
    $('#status').val(user.is_active ? 'Active' : 'Disabled');
    dirty();
  }

  function dirty() {
    const changed = user && ($('#full_name').val().trim() !== user.full_name || $('#email').val().trim() !== user.email);
    $('#save-btn').prop('disabled', !changed);
    return changed;
  }
  $('#full_name, #email').on('input', dirty);
  $('#reset-btn').on('click', () => { fill(); ['#full_name', '#email'].forEach(s => UI.fieldError(s, '')); $('#form-error').addClass('hidden'); });

  $('#profile-form').on('submit', function (e) {
    e.preventDefault();
    if (!dirty()) return;
    $('#form-error').addClass('hidden');
    const full_name = $('#full_name').val().trim();
    const email = $('#email').val().trim();
    const errors = {
      '#full_name': full_name.length >= 2 ? '' : 'Enter your full name.',
      '#email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.',
    };
    Object.entries(errors).forEach(([s, m]) => UI.fieldError(s, m));
    if (Object.values(errors).some(Boolean)) { $('[aria-invalid=true]').first().trigger('focus'); return; }

    const save = () => {
      UI.setLoading('#save-btn', true, 'Saving…');
      // Only full_name and email are ever sent – never role or is_active
      const body = {};
      if (full_name !== user.full_name) body.full_name = full_name;
      if (email !== user.email) body.email = email;
      API.patch('/api/users/profile/me', body, { silent: true }).done(res => {
        user = { ...user, ...(res.data || body) };
        Auth.updateUser({ ...Auth.getUser(), full_name: user.full_name, email: user.email });
        UI.flash('Profile updated.');
        window.location.reload(); // refresh header initials / name
      }).fail(xhr => {
        if (xhr.status === 409) {
          UI.fieldError('#email', 'That email is already used by another account. Please use a different one.');
          $('#email').trigger('focus');
        } else {
          $('#form-error').text(xhr.friendlyMessage).removeClass('hidden');
        }
        UI.setLoading('#save-btn', false);
      });
    };

    // Confirm before changing the email you log in with
    if (email !== user.email) {
      UI.confirm(`Change your login email to ${email}? You'll use it the next time you log in.`, { confirmText: 'Change email', danger: false }).then(ok => ok && save());
    } else save();
  });
});
