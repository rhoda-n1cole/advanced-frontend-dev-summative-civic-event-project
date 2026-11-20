/**
 * ui.js – small reusable UI helpers: toasts, loading states, skeletons,
 * empty/error states, confirm dialog, formatting, file validation.
 */
const UI = {
  /** Escape any API text before putting it into HTML (prevents XSS) */
  esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** Toast notification. type: success | error | info */
  toast(message, type = 'success') {
    const styles = {
      success: 'bg-emerald-700',
      error: 'bg-red-700',
      info: 'bg-slate-800',
    };
    const icons = { success: '✓', error: '!', info: 'i' };
    if (!$('#toast-region').length) {
      $('body').append('<div id="toast-region" class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm" aria-live="polite" aria-atomic="false"></div>');
    }
    const $t = $(`
      <div role="${type === 'error' ? 'alert' : 'status'}"
           class="${styles[type] || styles.info} text-white rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 translate-x-4 opacity-0 transition duration-300">
        <span aria-hidden="true" class="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20 text-xs font-bold">${icons[type] || 'i'}</span>
        <p class="text-sm flex-1">${UI.esc(message)}</p>
        <button type="button" class="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white rounded" aria-label="Dismiss notification">✕</button>
      </div>`);
    $('#toast-region').append($t);
    requestAnimationFrame(() => $t.removeClass('translate-x-4 opacity-0'));
    const remove = () => $t.addClass('opacity-0').delay(300).queue(function () { $(this).remove(); });
    $t.find('button').on('click', remove);
    setTimeout(remove, type === 'error' ? 7000 : 4000);
  },

  /** Store a toast to show on the next page (used before redirects) */
  flash(message, type = 'success') {
    sessionStorage.setItem('ce_flash', JSON.stringify({ msg: message, type }));
  },
  showFlash() {
    const raw = sessionStorage.getItem('ce_flash');
    if (!raw) return;
    sessionStorage.removeItem('ce_flash');
    try { const f = JSON.parse(raw); UI.toast(f.msg, f.type); } catch { /* ignore */ }
  },

  /** Put a button into / out of a loading state */
  setLoading($btn, loading, text = 'Please wait…') {
    $btn = $($btn);
    if (loading) {
      $btn.data('label', $btn.html()).prop('disabled', true).attr('aria-busy', 'true')
        .html(`<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px] mr-2" aria-hidden="true"></span>${UI.esc(text)}`);
    } else {
      $btn.prop('disabled', false).removeAttr('aria-busy').html($btn.data('label') || $btn.html());
    }
  },

  /** Skeleton cards while lists load */
  skeletonCards(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden animate-pulse" aria-hidden="true">
        <div class="h-40 bg-slate-200"></div>
        <div class="p-4 space-y-3">
          <div class="h-4 w-3/4 rounded bg-slate-200"></div>
          <div class="h-3 w-1/2 rounded bg-slate-200"></div>
          <div class="h-3 w-full rounded bg-slate-200"></div>
        </div>
      </div>`).join('');
  },
  skeletonRows(count = 5) {
    return Array.from({ length: count }, () =>
      '<div class="h-14 rounded-lg bg-slate-200 animate-pulse" aria-hidden="true"></div>').join('');
  },

  emptyState(title, text = '', actionHtml = '') {
    return `
      <div class="col-span-full rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
        <p class="text-lg font-semibold text-slate-800">${UI.esc(title)}</p>
        ${text ? `<p class="mt-1 text-slate-600">${UI.esc(text)}</p>` : ''}
        ${actionHtml ? `<div class="mt-4">${actionHtml}</div>` : ''}
      </div>`;
  },

  /** Error box with a Retry button (for network failures on critical loads) */
  errorState($container, message, retryFn) {
    $($container).html(`
      <div class="col-span-full rounded-xl bg-red-50 p-6 text-center ring-1 ring-red-200" role="alert">
        <p class="font-semibold text-red-800">${UI.esc(message || 'Something went wrong.')}</p>
        <button type="button" class="retry-btn mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">Try again</button>
      </div>`);
    $($container).find('.retry-btn').on('click', retryFn);
  },

  /**
   * Accessible confirm dialog. Returns a jQuery promise that resolves true/false.
   * Usage: UI.confirm('Delete this event?').then(ok => { if (ok) ... })
   */
  confirm(message, { confirmText = 'Confirm', danger = true } = {}) {
    const deferred = $.Deferred();
    const resolve = v => deferred.resolve(v);
    {
      const lastFocus = document.activeElement;
      const $m = $(`
        <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="confirm-title" class="text-lg font-semibold text-slate-900">Are you sure?</h2>
            <p class="mt-2 text-slate-700">${UI.esc(message)}</p>
            <div class="mt-6 flex justify-end gap-3">
              <button type="button" data-no class="rounded-lg px-4 py-2 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600">Cancel</button>
              <button type="button" data-yes class="rounded-lg px-4 py-2 font-medium text-white ${danger ? 'bg-red-700 hover:bg-red-800 focus:ring-red-600' : 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-600'} focus:outline-none focus:ring-2 focus:ring-offset-2">${UI.esc(confirmText)}</button>
            </div>
          </div>
        </div>`);
      const close = result => { $m.remove(); $(document).off('keydown.confirm'); lastFocus?.focus(); resolve(result); };
      $m.on('click', '[data-yes]', () => close(true));
      $m.on('click', '[data-no]', () => close(false));
      $m.on('click', e => { if (e.target === $m[0]) close(false); });
      $(document).on('keydown.confirm', e => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Tab') { // keep focus inside the dialog
          const $f = $m.find('button'); const first = $f[0], last = $f[$f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      $('body').append($m);
      $m.find('[data-no]').trigger('focus');
    }
    return deferred.promise();
  },

  /** Validate a chosen file against CONFIG.UPLOADS[kind]. Returns an error string or ''. */
  validateFile(file, kind) {
    if (!file) return '';
    const rule = CONFIG.UPLOADS[kind];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!rule.ext.includes(ext)) return `That file type isn't allowed. Please choose: ${rule.ext.map(e => e.toUpperCase()).join(', ')}.`;
    if (file.size > rule.maxMB * 1024 * 1024) return `File is too large (max ${rule.maxMB} MB).`;
    return '';
  },

  /** Show/clear an inline field error linked with aria-describedby */
  fieldError($input, message) {
    $input = $($input);
    const id = $input.attr('id') + '-error';
    $(`#${id}`).remove();
    if (message) {
      $input.attr({ 'aria-invalid': 'true', 'aria-describedby': id })
        .addClass('border-red-600').after(`<p id="${id}" class="mt-1 text-sm text-red-700">${UI.esc(message)}</p>`);
    } else {
      $input.removeAttr('aria-invalid aria-describedby').removeClass('border-red-600');
    }
  },

  formatDate(value, withTime = true) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleString(undefined, withTime
      ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  },

  timeAgo(value) {
    const s = Math.floor((Date.now() - new Date(value)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
    return UI.formatDate(value, false);
  },

  formatDuration(seconds) {
    seconds = Math.round(Number(seconds) || 0);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  },

  /** Read a query-string parameter, e.g. UI.param('id') on event.html?id=… */
  param(name) { return new URLSearchParams(window.location.search).get(name); },
};
