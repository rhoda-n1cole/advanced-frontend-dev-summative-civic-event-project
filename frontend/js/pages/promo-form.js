/**
 * Promo create / edit – ADMIN ONLY (Auth.requireAdmin() in the HTML)
 *  Create: POST /api/promos     (multipart/form-data, file key "video")
 *  Edit:   PUT  /api/promos/:id (multipart/form-data, video optional)
 */
$(function () {
  Layout.init();
  const id = UI.param('id');
  let previewUrl = null;

  if (id) {
    $('#form-title').text('Edit promo');
    $('#submit-btn').text('Save changes');
    $('#video-req').addClass('hidden');
    $('#video-help').text('Optional: choose a new video to replace the current one (MP4, MOV, AVI or MKV, up to 8 MB).');
    Promos.get(id).done(res => {
      const p = res.data;
      $('#title').val(p.title);
      $('#description').val(p.description || '');
      $('#caption_text').val(p.caption_text || '');
      $('#published').prop('checked', p.published !== false);
      $('#preview').attr('src', p.video_url).removeClass('hidden');
      $('#file-name').text('Current video – choose a file to replace it');
    }).fail(() => UI.errorState('#form', 'Could not load this promo.', () => location.reload()));
  }

  $('#video').on('change', function () {
    const file = this.files[0];
    UI.fieldError('#video', '');
    if (!file) return;
    const err = UI.validateFile(file, 'video');
    if (err) { this.value = ''; $('#file-name').text('No file chosen'); UI.fieldError('#video', err); UI.toast(err, 'error'); return; }
    $('#file-name').text(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    $('#preview').attr('src', previewUrl).removeClass('hidden');
  });

  $('#form').on('submit', function (e) {
    e.preventDefault();
    $('#form-error').addClass('hidden');
    const title = $('#title').val().trim();
    const description = $('#description').val().trim();
    const caption = $('#caption_text').val().trim();
    const published = $('#published').is(':checked');
    const file = $('#video')[0].files[0];

    const errors = {
      '#title': title ? '' : 'Title is required.',
      '#description': description ? '' : 'Description is required.',
      '#caption_text': caption ? '' : 'Captions are required so everyone can follow the video.',
      '#video': id || file ? '' : 'Please choose a video file.',
    };
    Object.entries(errors).forEach(([sel, msg]) => UI.fieldError(sel, msg));
    if (Object.values(errors).some(Boolean)) { $('[aria-invalid=true]').first().trigger('focus'); return; }

    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', description);
    fd.append('caption_text', caption);
    if (id) fd.append('published', published);
    if (file) fd.append('video', file);

    UI.setLoading('#submit-btn', true, file ? 'Uploading…' : 'Saving…');
    if (file) $('#progress-wrap').removeClass('hidden');
    const onProgress = p => { $('#progress-fill').css('width', p + '%'); $('#progress-text').text(p + '%'); $('#progress-bar').attr('aria-valuenow', p); };

    const req = id ? Promos.update(id, fd, onProgress) : Promos.create(fd, onProgress);
    req.then(res => {
      // New promos are always created as published; unpublish straight away if the box was unticked
      if (!id && !published) return Promos.unpublish(res.data.id).then(() => res);
      return res;
    }).done(res => {
      UI.flash(id ? 'Promo updated.' : 'Promo uploaded and residents notified! 🎬');
      window.location.href = `promo.html?id=${encodeURIComponent(res.data.id)}`;
    }).fail(xhr => {
      $('#form-error').text(xhr?.friendlyMessage || 'Something went wrong.').removeClass('hidden');
      $('#progress-wrap').addClass('hidden');
      UI.setLoading('#submit-btn', false);
    });
  });
});
