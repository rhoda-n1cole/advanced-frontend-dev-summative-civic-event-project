/**
 * Event create / edit (ADMIN ONLY – guarded by Auth.requireAdmin() in event-form.html)
 *  Create: POST /api/events     (multipart/form-data, file key "image")
 *  Edit:   PUT  /api/events/:id (multipart/form-data, image optional)
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  const isEdit = !!id;
  let previewUrl = null;

  // ISO string -> value for <input type="datetime-local"> in local time
  const toLocalInput = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // The API always publishes events, so the toggle is shown but locked on.
  $('#published').prop({ checked: true, disabled: true });

  if (isEdit) {
    $('#form-title').text('Edit event');
    $('#submit-btn').text('Save changes');
    UI.setLoading('#submit-btn', true, 'Loading…');
    EventsApi.get(id).done(res => {
      const e = res.data;
      $('#title').val(e.title);
      $('#description').val(e.description || '');
      $('#location').val(e.location || '');
      $('#starts_at').val(toLocalInput(e.starts_at));
      $('#ends_at').val(toLocalInput(e.ends_at));
      if (e.metadata?.image_url) {
        $('#preview').attr('src', e.metadata.image_url).removeClass('hidden');
        $('#file-name').text('Current image – choose a file to replace it');
      }
      document.title = `Edit ${e.title} · CivicEvents`;
    }).fail(() => UI.errorState('#event-form', 'Could not load this event.', () => location.reload()))
      .always(() => UI.setLoading('#submit-btn', false));
  } else {
    // Sensible defaults: tomorrow 10:00–12:00
    const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(10, 0, 0, 0);
    $('#starts_at').val(toLocalInput(t));
    $('#ends_at').val(toLocalInput(new Date(t.getTime() + 2 * 3600000)));
  }

  // Image preview + validation BEFORE uploading
  $('#image').on('change', function () {
    const file = this.files[0];
    UI.fieldError('#image', '');
    if (!file) return;
    const err = UI.validateFile(file, 'image');
    if (err) {
      this.value = '';
      UI.fieldError('#image', err);
      $('#file-name').text('No file chosen');
      UI.toast(err, 'error');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    $('#preview').attr('src', previewUrl).removeClass('hidden');
    $('#file-name').text(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    $('#clear-image').removeClass('hidden');
  });

  $('#clear-image').on('click', function () {
    $('#image').val('');
    $('#preview').addClass('hidden').attr('src', '');
    $('#file-name').text('No file chosen');
    $(this).addClass('hidden');
  });

  $('#event-form').on('submit', function (e) {
    e.preventDefault();
    $('#form-error').addClass('hidden');

    const title = $('#title').val().trim();
    const location = $('#location').val().trim();
    const start = $('#starts_at').val();
    const end = $('#ends_at').val();

    const errors = {
      '#title': title ? '' : 'Title is required.',
      '#location': location ? '' : 'Location is required.',
      '#starts_at': start ? '' : 'Start date and time are required.',
      '#ends_at': !end ? 'End date and time are required.' : (start && new Date(end) <= new Date(start) ? 'End must be after the start.' : ''),
    };
    Object.entries(errors).forEach(([sel, msg]) => UI.fieldError(sel, msg));
    if (Object.values(errors).some(Boolean)) { $('[aria-invalid=true]').first().trigger('focus'); return; }

    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', $('#description').val().trim());
    fd.append('location', location);
    fd.append('starts_at', new Date(start).toISOString());
    fd.append('ends_at', new Date(end).toISOString());
    fd.append('published', $('#published').is(':checked'));
    const file = $('#image')[0].files[0];
    if (file) fd.append('image', file);

    UI.setLoading('#submit-btn', true, isEdit ? 'Saving…' : 'Creating…');
    if (file) $('#progress-wrap').removeClass('hidden');
    const onProgress = p => {
      $('#progress-fill').css('width', p + '%');
      $('#progress-text').text(p + '%');
      $('#progress-bar').attr('aria-valuenow', p);
    };

    const req = isEdit ? EventsApi.update(id, fd, onProgress) : EventsApi.create(fd, onProgress);
    req.done(res => {
      UI.flash(isEdit ? 'Event updated.' : 'Event created and residents notified! 🎉');
      window.location.href = `event.html?id=${encodeURIComponent(res.data.id)}`;
    }).fail(xhr => {
      $('#form-error').text(xhr.friendlyMessage).removeClass('hidden');
      UI.setLoading('#submit-btn', false);
      $('#progress-wrap').addClass('hidden');
    });
  });
});
