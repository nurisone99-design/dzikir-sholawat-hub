# PRD — Yayasan Raudhatul Jannah Nurul Islam wa Iman

## Original Problem Statement
Web Information System & Admin Portal for "Yayasan Raudhatul Jannah Nurul Islam wa Iman - Majelis Dzikir dan Sholawat". Premium minimalist Islamic design (emerald #0F766E + gold #C5A059). Public website + secure Admin Portal with RBAC. Language: Bahasa Indonesia.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). JWT Bearer auth (localStorage `rj_token`). Generic `make_crud` factory for entities. Exports via pandas/openpyxl (xlsx) + reportlab (pdf). All routes under `/api`.
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + framer-motion + recharts + react-leaflet. Reusable `DataTable` + `CrudPage` config-driven master data.
- **Auth roles**: super_admin (full), admin_cabang (read+write), viewer (read-only).

## User Personas
- Super Admin: full control incl. user management, settings, backup/restore.
- Admin Cabang: manages master data & activities.
- Viewer: read-only monitoring.
- Public visitor / jamaah: browses info, contacts foundation.

## Core Requirements (static)
Public: Beranda, Profil, Pendiri & Penerus, Cabang & Peta (Leaflet), Galeri (lightbox), Kontak.
Admin: Dashboard (charts), Master Data (Cabang/Guru/Jamaah+ijazah/Pengurus/Users), Agenda + WA broadcast, Galeri admin, Laporan (Excel/PDF), Pesan, Audit Log, Pengaturan (settings + backup/restore), Profil Admin.

## Implemented (2026-06)
- Full public site with premium Islamic design, animated hero, live stats, announcements, agenda.
- Interactive Leaflet branch map + branch directory with WhatsApp buttons.
- Filterable gallery with lightbox; contact form persisting to DB.
- JWT auth + RBAC; seeded 3 test accounts.
- Admin dashboard with bar/pie charts + upcoming agenda.
- All master data CRUD with search/filter/sort/pagination/bulk-delete + Excel/PDF export.
- Ijazah multi-tag tracking (Kitab/Amaliah/Nama Dalam) for jamaah.
- Agenda WhatsApp broadcast (wa.me, filter by cabang).
- Galeri admin publish toggle, Laporan generator, Pesan inbox, Audit log, Settings, Backup/Restore JSON.
- Seed data: 5 cabang, 6 guru, 12 jamaah, pengurus, agenda, galeri.
- Backend tested 100% (38/38); frontend flows verified.

## Backlog
- P1: File/image upload for gallery (currently URL-based) via object storage.
- P1: Auto-calculate guru's jumlah_jamaah from linked jamaah.
- P2: Real WhatsApp Business API integration (currently wa.me click-to-chat).
- P2: Restore confirmation safeguard (auto-backup before restore).
- P2: Pagination server-side for very large datasets.

## Next Tasks
- Await user review; prioritize gallery upload + WA API if requested.

## Test Credentials
See /app/memory/test_credentials.md
