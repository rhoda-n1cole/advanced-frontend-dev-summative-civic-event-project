# CivicEvents – Frontend

An accessible, responsive frontend for the **CivicEvents+ API**: city events, audio announcements, video promos with captions, in-app notifications, event registration and feedback, and an admin dashboard.

**Stack:** HTML, Tailwind CSS (Play CDN) and jQuery 3.7. No build step and no other libraries; the charts are plain HTML/CSS.

---

## 1. Run the backend

The backend lives in `../backend`. Full details are in [`backend/README.md`](../backend/README.md).

1. **Install** Node.js 18+ and PostgreSQL 15+.
2. **Create the database.** In `psql` or pgAdmin, run:
   ```sql
   CREATE DATABASE "civic-events-db";
   ```
   (The quotes are needed because of the dashes.)
3. **Create the tables.** Run `backend/migrations/001_create_tables.sql` against that database:
   ```sql
   \c civic-events-db
   \i 'path/to/backend/migrations/001_create_tables.sql'
   ```
4. **Configure `backend/.env`:**
   ```
   DB_USER=postgres
   DB_PASS=<your postgres password>     # note: DB_PASS, not DB_PASSWORD
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=civic-events-db
   JWT_SECRET=<any long random string>
   ```
5. **Install and start:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   You should see `CivicEvents+ backend listening on port 4000` and `Connected to PostgreSQL`.
   Check it at http://localhost:4000/health.

6. **Create an admin account.** There is no seed file, and the website's sign-up form only creates normal users, so create the admin with Postman or Thunder Client:
   ```
   POST http://localhost:4000/api/auth/signup
   Content-Type: application/json

   { "full_name": "Admin User", "email": "admin@civic.com", "password": "Admin@1234", "role": "admin" }
   ```

## 2. Run the frontend

1. **Set the backend URL** in `frontend/js/config.js`:
   ```js
   API_BASE: 'http://localhost:4000'
   ```
   This is the only setting the frontend needs (no `.env`).
2. **Serve the `frontend` folder** with any static server:
   - **VS Code:** install the *Live Server* extension, right-click `frontend/login.html` and choose **Open with Live Server**.
   - **Or from the command line:** `npx serve frontend`, or `python -m http.server 5500 -d frontend`.
3. **Open the site and log in.** Use the admin account above, or create a normal user on the **Sign up** page.

The backend has CORS enabled, so the frontend can run on any port.

---

## 3. Project structure

```
frontend/
  index.html                 entry: redirects to login / events / dashboard
  login.html  signup.html    auth pages (strength meter, validation)
  events.html  event.html  event-form.html  my-registrations.html
  announcements.html  announcement.html  announcement-form.html
  promos.html  promo.html  promo-form.html
  notifications.html         inbox + detail (all users)
  profile.html               edit own name/email
  search.html                global search (events, announcements, promos)
  admin-dashboard.html  admin-users.html  admin-notifications.html
  forbidden.html             shown when a normal user opens an admin page
  js/
    config.js       API base URL, upload limits, page size
    auth.js         auth context (token + user), storage rules, ROLE GUARDS
    api.js          AJAX wrapper: Bearer token, error messages, 401/403 handling
    ui.js           toasts, skeletons, confirm dialog, validation, formatting
    layout.js       header/nav, notification bell + drawer, footer, admin sidebar
    events-api.js   events, registrations, feedback calls
    media-api.js    announcements, promos (+ list cache, WebVTT captions)
    audio-player.js accessible custom audio player
    charts.js       accessible HTML/CSS charts for the dashboard
    pages/*.js      one script per page
```

## 4. Authentication & token storage

- **After login**, the token and `{ id, full_name, email, role }` are stored by `Auth.save()` in `js/auth.js`:
  - **"Keep me signed in" unticked → `sessionStorage`.** This is the default and the safer option, because the data is cleared when the tab closes.
  - **Ticked → `localStorage`.** It persists across restarts. The trade-off is that any script running on the page can read it, which makes it more exposed to XSS. All API text is escaped (`UI.esc`) before being inserted into the page to reduce that risk.
- **Every protected request** sends `Authorization: Bearer <token>` (`js/api.js`).
- **Expired tokens:** the JWT `exp` is checked on every page load (`Auth.isExpired`). Any `401` from the API signs the user out and shows "Your session has expired".
- **`403` errors** show "You do not have permission… contact an administrator".

## 5. Role-based access guards (where to find them)

The frontend guards are for **user experience only**. Real security is enforced by the backend's `authenticate` and `authorize(['admin'])` middleware.

| Guard | Where | What it does |
|---|---|---|
| `Auth.requireLogin()` | `js/auth.js`, called at the top of every logged-in page | No or expired token → login page |
| `Auth.requireAdmin()` | `js/auth.js`, called in `event-form.html`, `announcement-form.html`, `promo-form.html`, `admin-*.html` | Normal users → `forbidden.html` |
| `Auth.redirectIfLoggedIn()` | `login.html`, `signup.html` | Logged-in users skip the auth pages |
| `data-admin-only` / `data-user-only` + `Auth.applyRoleVisibility()` | All pages; search for `ROLE GUARD (UI)` | Shows create/edit/delete/publish/delete-notification controls to admins only, and Register/Feedback to users only |
| Data filtering | `js/pages/*.js`; search for `ROLE GUARD (data)` | Normal users never see unpublished events, announcements or promos |
| Sign-up never sends `role` | `signup.html` | Self sign-ups are always normal users |
| Profile never sends `role` / `is_active` | `js/pages/profile.js` | Users can't change their own role or status |
| Disabled-account check | `login.html` | Blocks login when `is_active` is false |
| No role editing anywhere | `js/pages/admin-users.js` | Admins can enable/disable users but not change roles |

To see them all, search the code for `ROLE GUARD`.

## 6. Feature notes and backend limitations

The frontend works around these behaviours of the provided API:

- **Events:**
  - Create ignores `published`, so every event is published. The toggle is shown, locked on.
  - Events with registrations can't be deleted (database foreign key). The UI explains this.
- **Registrations:** after a user cancels, `POST /register` returns 409 for that event, so they can't re-register. The UI shows a message.
- **Feedback:** the full list and average for an event (`GET /api/event-feedback/event/:id`) is admin-only. Users see and edit their own review; admins see the average and all reviews. The UI enforces one review per user per event (as does the database).
- **Announcements:**
  - There is no `duration_seconds` or `transcript` column. Duration is read from the audio file's metadata.
  - `PUT` updates the title and published status only, not the audio file.
- **Promos:** captions are stored as plain text (`caption_text`), not a `.vtt` URL. The frontend builds a WebVTT track in the browser (or uses the text as-is if it starts with `WEBVTT`). The track is enabled by default, with a CC toggle and a full transcript.
- **Notifications:**
  - There is no mark-as-read endpoint, so read state is kept per user in `localStorage`. This is optimistic UI.
  - There is no create-notification endpoint, so broadcasts are created by the backend when content is created or published. Admins can delete notifications individually, in bulk, or by ID.
- **Users:** the backend login doesn't check `is_active`, so the frontend checks it after login.

## 7. UX & accessibility

- **Structure and keyboard:**
  - Semantic landmarks, a skip link, labels on every input, and `aria-live` regions.
  - Focus is trapped in dialogs; Escape closes menus, the drawer and dialogs.
  - Visible focus rings throughout.
- **Media:**
  - Keyboard-friendly audio player (Space, ←/→), with current time / duration, speed and volume, plus fallback text and a download link.
  - Video has native controls (play/pause, volume, fullscreen) and captions on by default.
- **Loading and feedback:**
  - Skeleton loaders, loading buttons and upload progress bars.
  - Toasts, confirmation dialogs, and empty and error states with **Try again**.
- **Forms:**
  - Client-side validation with inline errors.
  - File type/size checks before upload (image 2 MB, audio 5 MB, video 8 MB).
  - Image, audio and video previews.
- **Performance:**
  - Lazy-loaded video thumbnails (IntersectionObserver) and lazy images.
  - Cached promos list, invalidated on change.
- **Optimistic UI** for publish toggles, enable/disable, cancelling registrations and marking notifications read, reverted on failure.
- **Layout:** mobile-first responsive design and colour contrast that meets WCAG AA.
