/**
 * events-api.js – shared calls for events, registrations and feedback,
 * used by events.html, event.html, event-form.html and my-registrations.html.
 */
const EventsApi = {
  list: () => API.get('/api/events'),
  get: id => API.get(`/api/events/${encodeURIComponent(id)}`),

  /** Admin only. formData contains the text fields and optional file under key "image" */
  create: (formData, onProgress) => API.post('/api/events', formData, { onProgress, silent: true }),
  update: (id, formData, onProgress) => API.put(`/api/events/${encodeURIComponent(id)}`, formData, { onProgress, silent: true }),

  remove(id) {
    return API.del(`/api/events/${encodeURIComponent(id)}`, { silent: true }).fail(xhr => {
      // The database refuses to delete events that still have registrations
      UI.toast(xhr.status >= 500
        ? 'This event could not be deleted. Events that already have registrations or feedback are kept for the records.'
        : xhr.friendlyMessage, 'error');
    });
  },
};

const Registrations = {
  mine: () => API.get('/api/event-registrations/my-registrations'),

  register(eventId) {
    return API.post('/api/event-registrations/register', { event_id: eventId }, { silent: true }).fail(xhr => {
      UI.toast(xhr.status === 409
        ? 'You have already registered for this event before. If you cancelled, please contact the organisers to re-register.'
        : xhr.friendlyMessage, 'error');
    });
  },

  cancel: eventId => API.post('/api/event-registrations/cancel', { event_id: eventId }),

  /** Admin only */
  attendees: eventId => API.get(`/api/event-registrations/event/${encodeURIComponent(eventId)}/attendees`),
};

const Feedback = {
  mine: () => API.get('/api/event-feedback/my-feedback'),
  create: (eventId, rating, comment) => API.post('/api/event-feedback', { event_id: eventId, rating, comment }, { silent: true }),
  update: (id, rating, comment) => API.put(`/api/event-feedback/${encodeURIComponent(id)}`, { rating, comment }),
  /** Admin only – full list of feedback for one event */
  forEvent: eventId => API.get(`/api/event-feedback/event/${encodeURIComponent(eventId)}`),

  stars(rating, size = 'text-lg') {
    const r = Math.round(Number(rating) || 0);
    return `<span class="${size} text-amber-500" aria-hidden="true">${'★'.repeat(r)}<span class="text-slate-300">${'★'.repeat(5 - r)}</span></span><span class="sr-only">${r} out of 5 stars</span>`;
  },
};
