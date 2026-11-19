/**
 * api.js – one place for every request to the backend.
 *  - attaches "Authorization: Bearer <token>" to protected requests
 *  - unwraps the backend's { status, message, data } shape
 *  - turns errors into friendly messages (401 -> login, 403 -> contact admin)
 */
const API = {
  /**
   * @param {string} method  GET | POST | PUT | PATCH | DELETE
   * @param {string} path    e.g. '/api/events'
   * @param {object|FormData} [data]
   * @param {object} [opts]  { silent: true } to skip the automatic error toast,
   *                         { onProgress: fn(percent) } for upload progress
   * @returns jQuery promise resolving to the backend JSON ({ status, message, data })
   */
  request(method, path, data, opts = {}) {
    const isForm = data instanceof FormData;
    const settings = {
      url: CONFIG.API_BASE + path,
      method,
      headers: {},
      dataType: 'json',
      timeout: 60000,
    };

    const token = Auth.getToken();
    if (token) settings.headers.Authorization = 'Bearer ' + token;

    if (isForm) {
      // multipart/form-data upload – let the browser set the boundary
      settings.data = data;
      settings.processData = false;
      settings.contentType = false;
      if (opts.onProgress) {
        settings.xhr = function () {
          const xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100));
          });
          return xhr;
        };
      }
    } else if (data !== undefined) {
      settings.data = JSON.stringify(data);
      settings.contentType = 'application/json';
    }

    return $.ajax(settings).fail(xhr => {
      xhr.friendlyMessage = API.messageFor(xhr, path);
      if (API.handleAuthErrors(xhr, path)) return;
      if (!opts.silent) UI.toast(xhr.friendlyMessage, 'error');
    });
  },

  get(path, opts) { return API.request('GET', path, undefined, opts); },
  post(path, data, opts) { return API.request('POST', path, data, opts); },
  put(path, data, opts) { return API.request('PUT', path, data, opts); },
  patch(path, data, opts) { return API.request('PATCH', path, data, opts); },
  del(path, opts) { return API.request('DELETE', path, undefined, opts); },

  /** Build a user-friendly error message from any failed request */
  messageFor(xhr, path) {
    const body = xhr.responseJSON || {};
    // express-validator errors may come back as an array
    if (Array.isArray(body.errors) && body.errors.length) {
      return body.errors.map(e => e.msg || e.message).join(' ');
    }
    if (xhr.statusText === 'timeout') return 'The request timed out. Please try again.';
    if (xhr.status === 0) return 'Cannot reach the server. Check your connection or that the backend is running.';
    if (xhr.status === 403) return body.message || 'You do not have permission to do this. Please contact an administrator.';
    if (xhr.status === 404) return body.message || 'We could not find what you were looking for.';
    if (xhr.status >= 500) return body.message || 'Something went wrong on the server. Please try again shortly.';
    return body.message || `Request failed (${xhr.status}).`;
  },

  /** 401 on a protected route = expired/invalid token -> sign out and go to login */
  handleAuthErrors(xhr, path) {
    const isAuthRoute = path.startsWith('/api/auth/');
    if (xhr.status === 401 && !isAuthRoute) {
      Auth.logout('Your session has expired. Please log in again.');
      return true;
    }
    return false;
  },

  /** Make a backend file path absolute (uploads are served from /uploads) */
  fileUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return CONFIG.API_BASE + (url.startsWith('/') ? '' : '/') + url;
  },
};
