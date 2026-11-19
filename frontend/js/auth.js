/**
 * auth.js – global auth context.
 * Holds the token and the user { id, full_name, email, role }.
 *
 * Storage rules:
 *  - "Remember me" ticked  -> localStorage  (survives browser restarts, but any
 *    script on the page can read it, so it is more exposed to XSS)
 *  - not ticked            -> sessionStorage (cleared when the tab closes; safer default)
 */
const Auth = {
  save(token, user, remember) {
    Auth.clear();
    const store = remember ? localStorage : sessionStorage;
    store.setItem('ce_token', token);
    store.setItem('ce_user', JSON.stringify(user));
  },

  getToken() {
    return sessionStorage.getItem('ce_token') || localStorage.getItem('ce_token');
  },

  getUser() {
    const raw = sessionStorage.getItem('ce_user') || localStorage.getItem('ce_user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  },

  /** Update stored user (e.g. after profile edit) in whichever storage holds it */
  updateUser(user) {
    const store = localStorage.getItem('ce_token') ? localStorage : sessionStorage;
    store.setItem('ce_user', JSON.stringify(user));
  },

  isLoggedIn() { return !!Auth.getToken() && !Auth.isExpired(); },
  isAdmin() { return Auth.getUser()?.role === 'admin'; },

  /** The backend issues JWTs that expire after 1h – read "exp" from the payload */
  isExpired() {
    const token = Auth.getToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp * 1000 < Date.now();
    } catch { return false; }
  },

  clear() {
    ['ce_token', 'ce_user'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  },

  logout(message) {
    Auth.clear();
    if (message) sessionStorage.setItem('ce_flash', JSON.stringify({ msg: message, type: 'info' }));
    window.location.href = 'login.html';
  },

  /* =====================================================================
   *  ROLE-BASED ACCESS GUARDS (client side)
   *  These only control what the UI shows. Real security is enforced by
   *  the backend: authenticate() + authorize(['admin']) in
   *  backend/src/middlewares/auth.middleware.js.
   * ===================================================================== */

  /** GUARD 1 – page needs ANY logged-in user (admin or normal user). */
  requireLogin() {
    if (!Auth.getToken()) {
      window.location.replace('login.html');
      return false;
    }
    if (Auth.isExpired()) {
      Auth.logout('Your session has expired. Please log in again.');
      return false;
    }
    return true;
  },

  /** GUARD 2 – page is ADMIN ONLY. Normal users are sent to forbidden.html. */
  requireAdmin() {
    if (!Auth.requireLogin()) return false;
    if (!Auth.isAdmin()) {
      window.location.replace('forbidden.html');
      return false;
    }
    return true;
  },

  /** GUARD 3 – guest-only pages (login/signup): logged-in users skip ahead. */
  redirectIfLoggedIn() {
    if (Auth.isLoggedIn()) window.location.replace(Auth.homePage());
  },

  /**
   * GUARD 4 – element-level visibility.
   *  data-admin-only  -> shown only to admins (create/edit/delete buttons, admin links)
   *  data-user-only   -> shown only to normal users (e.g. Register, Add feedback)
   * Call after inserting new HTML that uses these attributes.
   */
  applyRoleVisibility(root) {
    const $root = root ? $(root) : $(document);
    const admin = Auth.isAdmin();
    $root.find('[data-admin-only]').toggleClass('hidden', !admin);
    $root.find('[data-user-only]').toggleClass('hidden', admin);
  },

  homePage() { return Auth.isAdmin() ? 'admin-dashboard.html' : 'events.html'; },
};
