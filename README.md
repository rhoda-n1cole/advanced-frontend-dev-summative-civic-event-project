# CivicEvents+ – Accessible City Events & Services Portal

A full-stack project. This fork adds the **frontend** (HTML, Tailwind CSS and jQuery) to the provided **backend** (Node.js, Express and PostgreSQL).

| Folder | What it is |
|---|---|
| [`frontend/`](frontend/) | The web app built for this assessment. **Setup, structure, role-guard map and notes: [`frontend/README.md`](frontend/README.md)** |
| [`backend/`](backend/) | The provided CivicEvents+ API ([`backend/README.md`](backend/README.md)) |
| `backend/migrations/001_create_tables.sql` | Creates the database tables |
| `backend/migrations/002_seed_data.sql` | Demo data: an admin, a user, events and notifications |

## Quick start

1. **Create the database.** In PostgreSQL, run:
   ```sql
   CREATE DATABASE "civic-events-db";
   ```
2. **Create the tables and load the demo data.** Run `001_create_tables.sql`, then `002_seed_data.sql`, against that database (`\i` in psql, or the Query Tool in pgAdmin).
3. **Configure the backend.** Fill in `backend/.env`: `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `JWT_SECRET`.
4. **Start the backend:**
   ```bash
   cd backend && npm install && npm run dev
   ```
   The API runs at **http://localhost:4000**.
5. **Point the frontend at the API.** `frontend/js/config.js` should say `API_BASE: 'http://localhost:4000'`.
6. **Serve the frontend.** Open `frontend/login.html` with VS Code Live Server, or run `npx serve frontend`.
7. **Log in.**
   - Admin: `admin@civic.com` / `Admin@1234`
   - Normal user: `user@civic.com` / `User@1234`

## Features

- **Accounts:** sign up (with password strength meter) and log in, with session or persistent tokens and automatic sign-out when the token expires.
- **Events:** list with search, date and location filters and pagination; detail page with map link; register and cancel; feedback with ratings; admin create/edit/delete with image upload.
- **Announcements:** accessible audio player; admin upload, edit, publish/unpublish and delete.
- **Promos:** video with captions on by default, CC toggle and transcript; admin upload, edit, publish/unpublish and delete.
- **Notifications:** bell with unread count, drawer, inbox with detail and links to the related item; admin delete (single, bulk, or by ID).
- **Dashboards:** an admin dashboard with charts, and a dashboard for normal users.
- **Admin tools:** user management (enable/disable, view profile; roles can't be changed).
- **Everyone:** My registrations, My profile, and global search.
- **Role-based UI** for admin and normal users. Search the code for `ROLE GUARD` to find every guard.

## Demo video

_Add your video link here._
