# QRERP

QRERP is a mobile-first warehouse ERP demo built with React and Vite. It includes dashboarding, QR scanning and generation, scan history, receiving, inventory, putaway, cycle count, order picking, shipping, safety, equipment, reports, and settings.

## Highlights

- Professional white-and-blue warehouse ERP interface
- Desktop sidebar and mobile bottom navigation
- Browser camera QR scanning with manual entry fallback
- JSON QR payload generator with print label preview
- Demo warehouse data backed by `localStorage`
- GitHub Pages-friendly routing using `HashRouter`

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## GitHub Pages

This project includes a GitHub Actions workflow that builds and deploys the app to GitHub Pages on pushes to `main`.
