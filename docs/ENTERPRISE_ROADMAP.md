# QRERP enterprise modernization program

## Source of truth
- **Visual reference:** user-supplied QR Legends ZIP (Flask/static HTML, CSS, JS). Match its operating patterns and terminology while preserving QRERP's React/Vite build, routing, and working pages. Do not replace QRERP wholesale with the Flask application.
- **Working repository:** QRERP. No direct production migrations, no secrets/GP database in Git.
- **Non-negotiable:** responsive desktop/mobile, light/dark mode, handheld keyboard-wedge scanner support, phone-camera fallback where supported, branch-aware operations, immutable posting/audit trails.

## Project lanes / AI-agent assignments
| Owner | Scope | First issue acceptance criteria |
|---|---|---|
| Architecture | Unified identifiers, company/branch tenancy, API contract | Versioned schema and cross-module event definitions |
| GP Migration | SQL/CSV extract, mapping, validation, rollback | Read-only prototype + discrepancy report; counts/totals reconcile |
| Warehouse | Receiving, directed putaway, picking, bins, transfer | Scanner test paths, duplicate-scan protection, stock ledger consistency |
| Sales | Customer, quotes, price rules, sales orders | Quote-to-order-to-pick lifecycle, authorized access |
| Finance | GL, AP, AR, invoicing, tax, period closes | Select proven accounting engine; dual-run reconciliation |
| Purchasing | Vendors, PO/EDI, receive/returns, invoice match | PO and line lifecycle, UOM conversion and variance approvals |
| Production | Pulled/checked/putaway lines, downtime, targets | Filter by branch/date/employee; weekly totals ÷ 5, configurable workdays |
| UI & Devices | QR Legends design parity, theme, scanners, labels | Responsive contrast checks and browser/device matrix |
| Security/QA | Roles, RLS, audit trail, safe transactions | Automated unauthorized-branch and double-posting tests |
| DevOps | CI, staging, backups, deployment | Build/test pipeline, restore drill and rollback plan |

## Release gates
1. Feature branch and pull request; no direct push to `main`.
2. Build, automated tests and manual mobile scanner QA.
3. Data writes only through validated backend transactions with idempotency, audit log and authorization.
4. Production GP migration only after signed reconciliation and departmental sign-off.
5. Branch-by-branch pilot with an explicit rollback plan.

## Immediate follow-up
- Create numbered GitHub issues from each row, assign developers, and define dependencies.
- Build production reporting connected to authenticated shared storage rather than browser-only state.
- Extend existing putaway page, which already captures scans and saves Firestore sessions, instead of creating a competing data silo.
- Make the Sales page functional only after customer/order schema and permission review.
- Obtain lawful, read-only GP exports and a complete module/integration inventory from the company's IT and finance teams.

## Status
This branch includes initial UI/theme and the enterprise department capability map. It is **not** a full replacement for Great Plains or a pixel-perfect port of every Flask ZIP screen.
