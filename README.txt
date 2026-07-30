MOSQUE WORLDCLASS V7 — RENDER + POSTGRESQL
==========================================

LOCAL:
1) npm install
2) npm start
3) Open http://localhost:3000

PAGES:
TV:     /
Mobile: /mobile-app.html
Admin:  /admin.html
Health: /api/health

DEFAULT LOCAL ADMIN PIN:
1234

Change ADMIN_PIN before production. On Render, the Blueprint asks for it.

PRODUCTION:
- render.yaml provisions the Node.js service and Render PostgreSQL database.
- DATABASE_URL is connected automatically.
- Settings persist in PostgreSQL.
- Admin changes are logged in admin_audit_log.
- Socket.IO broadcasts updates to every connected display.
- HTTPS enables phone location and compass permissions.
- Cairo fonts and the complete Quran dataset are bundled locally.

Read DEPLOY_RENDER_AR.md for the exact Arabic deployment steps.
