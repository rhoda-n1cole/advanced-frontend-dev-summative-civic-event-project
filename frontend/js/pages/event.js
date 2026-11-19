/**
 * Event detail page – event.html?id=<uuid>
 *  GET  /api/events/:id
 *  User:  register / cancel, add or edit their ONE feedback entry
 *  Admin: registrants (GET /api/event-registrations/event/:id/attendees)
 *         all feedback + average rating (GET /api/event-feedback/event/:id)
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  if (!id) { window.location.replace('events.html'); return; }

  let event = null;
  let registered = false;
  let myFeedback = null;
  let rating = 0;

  load();

  function load() {
    EventsApi.get(id).done(res => {
      event = res.data;
      // ROLE GUARD (data): unpublished events are hidden from normal users
      if (!Auth.isAdmin() && event.published === false) {
        $('#event').html(UI.emptyState('This event is not available', 'It may have been unpublished.', '<a class="font-semibold text-blue-700 underline" href="events.html">Back to events</a>'));
        $('#feedback-section').addClass('hidden');
        return;
      }
      document.title = `${event.title} · CivicEvents`;
      if (Auth.isAdmin()) {
        renderEvent();
        loadAttendees();
        loadAllFeedback();
      } else {
        $.when(Registrations.mine(), Feedback.mine()).done((regs, fbs) => {
          registered = (regs[0].data || []).some(r => r.event_id === id && r.status === 'registered');
          myFeedback = (fbs[0].data || []).find(f => f.event_id === id) || null;
        }).always(() => { renderEvent(); renderMyFeedback(); });
      }
    }).fail(xhr => {
      if (xhr.status === 404) {
        $('#event').html(UI.emptyState('Event not found', 'It may have been removed.', '<a class="font-semibold text-blue-700 underline" href="events.html">Back to events</a>'));
        $('#feedback-section, #attendees-section').remove();
      } else {
        UI.errorState('#event', 'We couldn\'t load this event.', load);
      }
    });
  }

  function renderEvent() {
    const e = event;
    const img = e.metadata?.image_url;
    const past = new Date(e.ends_at || e.starts_at) < new Date();
    const mapUrl = e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : '';

    $('#event').html(`
      <article class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        ${img
          ? `<img src="${UI.esc(img)}" alt="Image for ${UI.esc(e.title)}" class="max-h-[420px] w-full bg-slate-200 object-cover">`
          : '<div class="flex h-48 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-6xl" aria-hidden="true">📅</div>'}
        <div class="p-6 sm:p-8">
          <div class="flex flex-wrap gap-2">
            ${e.published === false ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unpublished</span>' : ''}
            ${registered ? '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ You\'re registered</span>' : ''}
            ${past ? '<span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">This event has ended</span>' : ''}
          </div>
          <h1 class="mt-2 text-3xl font-bold">${UI.esc(e.title)}</h1>

          <dl class="mt-5 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-sm font-semibold text-slate-600">Starts</dt>
              <dd class="mt-1"><time datetime="${UI.esc(e.starts_at)}">${UI.formatDate(e.starts_at)}</time></dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-sm font-semibold text-slate-600">Ends</dt>
              <dd class="mt-1"><time datetime="${UI.esc(e.ends_at)}">${UI.formatDate(e.ends_at)}</time></dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <dt class="text-sm font-semibold text-slate-600">Location</dt>
              <dd class="mt-1 flex flex-wrap items-center gap-3">
                <span>${UI.esc(e.location || 'To be announced')}</span>
                ${mapUrl ? `<a href="${mapUrl}" target="_blank" rel="noopener" class="text-sm font-semibold text-blue-700 underline hover:text-blue-900">Open in Google Maps<span class="sr-only"> (opens in a new tab)</span> ↗</a>` : ''}
              </dd>
            </div>
          </dl>

          <h2 class="mt-6 text-lg font-semibold">About this event</h2>
          <p class="mt-2 whitespace-pre-line leading-relaxed text-slate-700">${UI.esc(e.description || 'No description provided.')}</p>

          <div class="mt-8 flex flex-wrap gap-3">
            ${past ? '' : `
            <!-- ROLE GUARD (UI): normal users register / cancel -->
            <button id="reg-btn" type="button" data-user-only class="hidden rounded-lg px-5 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 ${registered ? 'bg-white text-red-700 ring-1 ring-red-700 hover:bg-red-50 focus:ring-red-600' : 'bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-600'}">
              ${registered ? 'Cancel registration' : 'Register for this event'}
            </button>`}
            <!-- ROLE GUARD (UI): admins edit / delete -->
            <a href="event-form.html?id=${encodeURIComponent(e.id)}" data-admin-only class="hidden rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">Edit event</a>
            <button id="delete-btn" type="button" data-admin-only class="hidden rounded-lg px-5 py-2.5 font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600">Delete</button>
          </div>
        </div>
      </article>`);
    Auth.applyRoleVisibility();
  }

  // ----- registration (users) -----
  $('#event').on('click', '#reg-btn', function () {
    const $b = $(this);
    if (registered) {
      UI.confirm('Cancel your registration for this event?', { confirmText: 'Yes, cancel' }).then(ok => {
        if (!ok) return;
        UI.setLoading($b, true, 'Cancelling…');
        Registrations.cancel(id)
          .done(() => { registered = false; UI.toast('Your registration was cancelled.', 'info'); renderEvent(); })
          .fail(() => UI.setLoading($b, false));
      });
    } else {
      UI.setLoading($b, true, 'Registering…');
      Registrations.register(id)
        .done(() => { registered = true; UI.toast('You\'re registered! 🎉'); renderEvent(); })
        .fail(() => UI.setLoading($b, false));
    }
  });

  // ----- delete (admin) -----
  $('#event').on('click', '#delete-btn', function () {
    UI.confirm(`Delete "${event.title}"? This cannot be undone.`, { confirmText: 'Delete event' }).then(ok => {
      if (!ok) return;
      EventsApi.remove(id).done(() => { UI.flash('Event deleted.'); window.location.href = 'events.html'; });
    });
  });

  // ----- registrants (admin) -----
  function loadAttendees() {
    $('#attendees').html(`<div class="space-y-2">${UI.skeletonRows(3)}</div>`);
    Registrations.attendees(id).done(res => {
      const list = res.data || [];
      $('#attendee-count').text(`${list.length} registered`);
      if (!list.length) { $('#attendees').html('<p class="text-slate-600">No one has registered yet.</p>'); return; }
      $('#attendees').html(`
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">People registered for this event</caption>
            <thead class="border-b border-slate-200 text-slate-600">
              <tr><th scope="col" class="py-2 pr-4 font-semibold">Name</th><th scope="col" class="py-2 pr-4 font-semibold">Email</th><th scope="col" class="py-2 font-semibold">Registered on</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${list.map(a => `<tr><td class="py-2 pr-4 font-medium">${UI.esc(a.full_name)}</td><td class="py-2 pr-4"><a class="text-blue-700 hover:underline" href="mailto:${UI.esc(a.email)}">${UI.esc(a.email)}</a></td><td class="py-2">${UI.formatDate(a.created_at, false)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`);
    }).fail(() => $('#attendees').html('<p class="text-red-700">Could not load registrants.</p>'));
  }

  // ----- feedback -----
  function summaryHtml(list) {
    if (!list.length) return '<p class="text-slate-600">No feedback yet.</p>';
    const avg = list.reduce((s, f) => s + Number(f.rating || 0), 0) / list.length;
    return `
      <div class="flex items-center gap-3">
        <span class="text-4xl font-bold">${avg.toFixed(1)}</span>
        <div>${Feedback.stars(avg, 'text-2xl')}<p class="text-sm text-slate-600">Average from ${list.length} review${list.length === 1 ? '' : 's'}</p></div>
      </div>`;
  }

  function loadAllFeedback() {
    Feedback.forEvent(id).done(res => {
      const list = res.data || [];
      $('#rating-summary').html(summaryHtml(list));
      $('#feedback-list').html(list.map(f => `
        <li class="py-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold">${UI.esc(f.full_name || 'Attendee')}</p>
            <p class="text-xs text-slate-500">${UI.formatDate(f.created_at, false)}</p>
          </div>
          <div class="mt-1">${Feedback.stars(f.rating)}</div>
          ${f.comment ? `<p class="mt-1 text-slate-700">${UI.esc(f.comment)}</p>` : ''}
        </li>`).join(''));
    }).fail(() => $('#rating-summary').html('<p class="text-red-700">Could not load feedback.</p>'));
  }

  function renderMyFeedback() {
    // The API only shares the full feedback list with admins, so normal users see their own review.
    $('#rating-summary').html('<p class="text-sm text-slate-600">Share how the event went. Each attendee can leave one review per event.</p>');
    if (myFeedback) {
      $('#my-feedback').html(`
        <div class="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
          <div class="flex items-center justify-between">
            <p class="font-semibold text-blue-900">Your review</p>
            <button id="fb-edit" type="button" class="text-sm font-semibold text-blue-700 underline hover:text-blue-900">Edit</button>
          </div>
          <div class="mt-1">${Feedback.stars(myFeedback.rating)}</div>
          ${myFeedback.comment ? `<p class="mt-1 text-slate-700">${UI.esc(myFeedback.comment)}</p>` : ''}
        </div>`);
      $('#feedback-form').addClass('hidden');
    } else {
      $('#my-feedback').empty();
      showForm(0, '');
    }
  }

  function showForm(r, comment) {
    setRating(r);
    $('#fb-comment').val(comment);
    $('#fb-submit').text(myFeedback ? 'Save changes' : 'Submit feedback');
    $('#fb-cancel').toggleClass('hidden', !myFeedback);
    $('#feedback-form').removeClass('hidden');
  }

  // Accessible star picker (radio group, arrow keys work)
  $('#star-input').html([1, 2, 3, 4, 5].map(n => `
    <button type="button" role="radio" aria-checked="false" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}"
      class="star text-3xl text-slate-300 hover:scale-110 transition focus:outline-none focus:ring-2 focus:ring-blue-600 rounded">★</button>`).join(''));

  function setRating(r) {
    rating = r;
    $('#star-input .star').each(function () {
      const n = $(this).data('star');
      $(this).toggleClass('text-amber-500', n <= r).toggleClass('text-slate-300', n > r)
        .attr({ 'aria-checked': n === r, tabindex: (n === (r || 1)) ? 0 : -1 });
    });
  }
  $('#star-input').on('click', '.star', function () { setRating($(this).data('star')); UI.fieldError('#star-input', ''); });
  $('#star-input').on('keydown', '.star', function (e) {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, (rating || 0) + dir));
    setRating(next);
    $(`#star-input [data-star=${next}]`).trigger('focus');
  });

  $('#feedback-section').on('click', '#fb-edit', () => { $('#my-feedback').empty(); showForm(myFeedback.rating, myFeedback.comment || ''); });
  $('#fb-cancel').on('click', renderMyFeedback);

  $('#feedback-form').on('submit', function (e) {
    e.preventDefault();
    if (!rating) { UI.fieldError('#star-input', 'Please choose a rating from 1 to 5 stars.'); $('#star-input .star').first().trigger('focus'); return; }
    const comment = $('#fb-comment').val().trim();
    UI.setLoading('#fb-submit', true, 'Saving…');
    const req = myFeedback ? Feedback.update(myFeedback.id, rating, comment) : Feedback.create(id, rating, comment);
    req.done(res => {
      myFeedback = res.data;
      UI.toast('Thanks for your feedback!');
      renderMyFeedback();
    }).fail(xhr => {
      // Duplicate (one feedback per user per event) comes back as 409 from the DB unique constraint
      if (!myFeedback && xhr.status === 409) UI.toast('You have already left feedback for this event.', 'error');
      else if (!myFeedback) UI.toast(xhr.friendlyMessage, 'error');
    }).always(() => UI.setLoading('#fb-submit', false));
  });
});
