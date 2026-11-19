/**
 * media-api.js – Announcements (audio) and Promos (video + captions).
 * Also: a tiny sessionStorage cache for lists, invalidated on create/update/delete.
 */
const Cache = {
  ttl: 5 * 60 * 1000, // 5 minutes
  get(key) {
    try {
      const hit = JSON.parse(sessionStorage.getItem('ce_cache_' + key));
      return hit && Date.now() - hit.t < Cache.ttl ? hit.v : null;
    } catch { return null; }
  },
  set(key, value) { try { sessionStorage.setItem('ce_cache_' + key, JSON.stringify({ t: Date.now(), v: value })); } catch { /* full */ } },
  clear(key) { sessionStorage.removeItem('ce_cache_' + key); },
};

const Announcements = {
  list: (page = 1, limit = 50) => API.get(`/api/announcements?page=${page}&limit=${limit}`),
  get: id => API.get(`/api/announcements/${encodeURIComponent(id)}`),
  /** Admin only. FormData with title, published and the file under key "audio" */
  create: (fd, onProgress) => API.post('/api/announcements', fd, { onProgress, silent: true }),
  /** Admin only. The API updates title / published (not the audio file). */
  update: (id, data) => API.put(`/api/announcements/${encodeURIComponent(id)}`, data, { silent: true }),
  publish: id => API.patch(`/api/announcements/${encodeURIComponent(id)}/publish`),
  unpublish: id => API.patch(`/api/announcements/${encodeURIComponent(id)}/unpublish`),
  remove: id => API.del(`/api/announcements/${encodeURIComponent(id)}`),
};

const Promos = {
  /** Cached list (promos rarely change). Pass fresh=true to skip the cache. */
  list(fresh = false) {
    const cached = !fresh && Cache.get('promos');
    if (cached) return $.Deferred().resolve({ data: cached, cached: true }).promise();
    return API.get('/api/promos?page=1&limit=100').done(res => Cache.set('promos', res.data || []));
  },
  get: id => API.get(`/api/promos/${encodeURIComponent(id)}`),
  create: (fd, onProgress) => API.post('/api/promos', fd, { onProgress, silent: true }).done(() => Cache.clear('promos')),
  update: (id, fd, onProgress) => API.put(`/api/promos/${encodeURIComponent(id)}`, fd, { onProgress, silent: true }).done(() => Cache.clear('promos')),
  publish: id => API.patch(`/api/promos/${encodeURIComponent(id)}/publish`).done(() => Cache.clear('promos')),
  unpublish: id => API.patch(`/api/promos/${encodeURIComponent(id)}/unpublish`).done(() => Cache.clear('promos')),
  remove: id => API.del(`/api/promos/${encodeURIComponent(id)}`).done(() => Cache.clear('promos')),

  /**
   * The API stores captions as plain text (caption_text), not a .vtt file.
   * Build a WebVTT captions track from it so <track kind="captions"> works:
   *  - if the admin pasted real WebVTT, use it as-is
   *  - otherwise split the text into sentences and spread them over the video duration
   * Returns an object URL to use as the <track> src.
   */
  captionsUrl(captionText, durationSeconds) {
    const text = (captionText || '').trim();
    if (!text) return '';
    let vtt;
    if (text.startsWith('WEBVTT')) {
      vtt = text;
    } else {
      const chunks = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g).map(s => s.trim()).filter(Boolean);
      const total = durationSeconds && isFinite(durationSeconds) ? durationSeconds : chunks.length * 4;
      const slot = total / chunks.length;
      const ts = s => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(3);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.padStart(6, '0')}`;
      };
      vtt = 'WEBVTT\n\n' + chunks.map((c, i) => `${i + 1}\n${ts(i * slot)} --> ${ts((i + 1) * slot)}\n${c}\n`).join('\n');
    }
    return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  },
};

/** Shared publish badge */
function publishBadge(published) {
  return published === false
    ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unpublished</span>'
    : '<span data-admin-only class="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Published</span>';
}
