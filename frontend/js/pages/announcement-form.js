/**
 * Announcement create / edit – ADMIN ONLY (Auth.requireAdmin() in the HTML)
 *  Create: POST /api/announcements (multipart/form-data, file key "audio")
 *  Edit:   PUT  /api/announcements/:id (title + published)
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  let previewUrl = null;

  const syncButton = () => {
    if (id) return;
    $('#submit-btn').text($('#published').is(':checked') ? 'Publish announcement' : 'Save as unpublished');
  };
  $('#published').on('change', syncButton);

  if (id) {
    $('#form-title').text('Edit announcement');
    $('#submit-btn').text('Save changes');
    $('#audio-field').addClass('hidden');
    Announcements.get(id).done(res => {
      const a = res.data;
      $('#title').val(a.title);
      $('#published').prop('checked', a.published !== false);
      $('#current-audio').removeClass('hidden');
      AudioPlayer.mount('#current-player', { src: a.audio_url, title: a.title });
    }).fail(() => UI.errorState('#form', 'Could not load this announcement.', () => location.reload()));
  }

  $('#audio').on('change', function () {
    const file = this.files[0];
    UI.fieldError('#audio', '');
    $('#preview').empty();
    if (!file) return;
    const err = UI.validateFile(file, 'audio');
    if (err) { this.value = ''; $('#file-name').text('No file chosen'); UI.fieldError('#audio', err); UI.toast(err, 'error'); return; }
    $('#file-name').text(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    AudioPlayer.mount('#preview', { src: previewUrl, title: 'Preview' });
    if (!$('#title').val()) $('#title').val(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
  });

  $('#form').on('submit', function (e) {
    e.preventDefault();
    $('#form-error').addClass('hidden');
    const title = $('#title').val().trim();
    const published = $('#published').is(':checked');
    const file = $('#audio')[0].files[0];

    UI.fieldError('#title', title ? '' : 'Title is required.');
    if (!id) UI.fieldError('#audio', file ? '' : 'Please choose an audio file.');
    if (!title || (!id && !file)) { $('[aria-invalid=true]').first().trigger('focus'); return; }

    UI.setLoading('#submit-btn', true, id ? 'Saving…' : 'Uploading…');
    let req;
    if (id) {
      req = Announcements.update(id, { title, published });
    } else {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('published', published);
      fd.append('audio', file);
      $('#progress-wrap').removeClass('hidden');
      req = Announcements.create(fd, p => {
        $('#progress-fill').css('width', p + '%'); $('#progress-text').text(p + '%'); $('#progress-bar').attr('aria-valuenow', p);
      });
    }
    req.done(res => {
      // On create the backend also sends a notification to all residents
      UI.flash(id ? 'Announcement updated.' : 'Announcement created and residents notified! 📢');
      window.location.href = `announcement.html?id=${encodeURIComponent(res.data.id)}`;
    }).fail(xhr => {
      $('#form-error').text(xhr.friendlyMessage).removeClass('hidden');
      $('#progress-wrap').addClass('hidden');
      UI.setLoading('#submit-btn', false);
    });
  });
});
