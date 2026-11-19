-- 002_seed_data.sql – sample data for local development / demo
-- Run with:  npm run db:seed   (or in psql:  \i migrations/002_seed_data.sql)
-- Safe to run more than once.
--
-- Accounts created:
--   admin@civic.com / Admin@1234   (role: admin)
--   user@civic.com  / User@1234    (role: user)
-- Passwords are hashed with bcrypt via pgcrypto, compatible with the backend's bcrypt.compare().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (full_name, email, password_hash, role)
VALUES
  ('Admin User', 'admin@civic.com', crypt('Admin@1234', gen_salt('bf', 10)), 'admin'),
  ('Demo Resident', 'user@civic.com', crypt('User@1234', gen_salt('bf', 10)), 'user')
ON CONFLICT (email) DO NOTHING;

-- Sample events (dates are relative to when you run the seed)
INSERT INTO events (title, description, location, starts_at, ends_at, published)
SELECT v.title, v.description, v.location, NOW() + v.start_offset, NOW() + v.start_offset + v.length, true
FROM (VALUES
  ('Community Clean-Up Day', 'Join neighbours to clean streets, parks and drains. Gloves, bags and refreshments provided.', 'Nyamirambo Stadium, Kigali', INTERVAL '3 days', INTERVAL '4 hours'),
  ('Youth Coding Bootcamp', 'A free one-day introduction to web development for residents aged 15–25. Bring a laptop if you have one.', 'Kigali Public Library', INTERVAL '7 days', INTERVAL '6 hours'),
  ('City Budget Town Hall', 'Hear the proposed city budget and share your priorities with council members. Sign-language interpretation available.', 'City Hall, Kigali', INTERVAL '10 days', INTERVAL '2 hours'),
  ('Farmers Market', 'Fresh local produce, crafts and live music. Accessible entrance on the east side.', 'Kimironko Market', INTERVAL '14 days', INTERVAL '5 hours'),
  ('Health & Wellness Fair', 'Free blood-pressure checks, nutrition advice and fitness classes for all ages.', 'Amahoro Stadium', INTERVAL '21 days', INTERVAL '6 hours'),
  ('Tree Planting Morning', 'We planted 300 trees together. Thank you to everyone who came!', 'Mount Kigali', INTERVAL '-5 days', INTERVAL '3 hours')
) AS v(title, description, location, start_offset, length)
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = v.title);

-- A broadcast notification for each seeded event (only once)
INSERT INTO notifications (title, message, type, recipient_id, metadata)
SELECT 'New Event Published', 'A new event titled "' || e.title || '" has been added!', 'event', NULL, jsonb_build_object('event_id', e.id)
FROM events e
WHERE e.title IN ('Community Clean-Up Day', 'Youth Coding Bootcamp', 'City Budget Town Hall', 'Farmers Market', 'Health & Wellness Fair')
  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.metadata->>'event_id' = e.id::text);

-- A welcome message for the demo resident only (shows a targeted notification)
INSERT INTO notifications (title, message, type, recipient_id, metadata)
SELECT 'Welcome to CivicEvents!', 'Hi ' || u.full_name || ', browse upcoming events and register to save your spot.', 'system', u.id, '{}'::jsonb
FROM users u
WHERE u.email = 'user@civic.com'
  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_id = u.id AND n.title = 'Welcome to CivicEvents!');
