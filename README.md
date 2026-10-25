# OneBros Checker Dashboard

A compact, mobile-first challenge run review preview using HTML, CSS, JavaScript modules and Vite.

## Public team preview

The production build uses exclusively synthetic demo submissions. All demo runner and checker identities, notes and dates are fictional. There is no authentication, live synchronization, claim mutation or verification write access.

Home counters link to filtered Queue views. Queue supports runner search, game/tier/status/checker filters and date sorting. Run Details are read-only. My Claims uses a clearly labeled preview checker filter. Statistics are available under More.

## Development

Requires Node.js 20.19+ or 22.12+ and npm. Python 3.5+ is needed only for the optional local importer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/checker.dashboard/. On Windows PowerShell use `npm.cmd` if the execution policy blocks `npm.ps1`.

With no private snapshot present, development also uses synthetic data. To inspect a private Excel export locally:

```sh
python scripts/import-snapshot.py "C:\path\to\export.xlsx"
```

The importer opens the workbook read-only. It validates the seven game worksheet schemas, ignores formula-only rows and preserves the original dates and checker names. Import time is not export time, and worksheet timezone is unspecified. Row-independent fingerprints identify snapshot records; edits to identity fields require future reconciliation.

Private data goes only to Git-ignored `.local/snapshot.json`. Never add exports or private records to `src/`, `public/`, tests or documentation. The loopback Vite development middleware is not authentication and must not be exposed, forwarded or used as a hosted backend. Production never requests this data; it always loads demo data.

## Validation

```sh
npm test
python tests/import_snapshot_test.py
node scripts/check-public-files.js
npm run build
npm run check:private-build
npm run preview
```

Preview the static build at http://127.0.0.1:4173/checker.dashboard/. Local privacy checks compare public files and build output against locally available snapshots; CI also checks tracked paths and credential patterns. Review is still required before publishing any new data files.

## Hosting

GitHub Pages serves the static build at `/checker.dashboard/`. The Pages workflow tests, builds and uploads only `dist/`. Private local files, Excel exports and credentials are excluded from Git and build artifacts.

The interface uses Inter and Cormorant Garamond via Google Fonts with system fallbacks. No private data is sent to the font service.
