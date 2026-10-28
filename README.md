# AIsathi homepage

Local implementation of the supplied warm-paper/coral homepage plan. No install, framework, build, external fonts, or network assets required.

```powershell
cd A:\AiSathi
npm run dev
```

Open http://127.0.0.1:3010. Use `$env:PORT = 3011` before starting to choose another port. `Ctrl+C` stops the preview. The page also opens directly from `index.html`; use the local server for clipboard access.

```powershell
npm test
npm run check
```

- `index.html`: page structure and content.
- `styles.css`: design tokens, responsive layouts, focus and reduced-motion styles.
- `app.js`: mode switch, mobile navigation, copy feedback, disclosure anchors.
- `scripts/serve.mjs`: loopback-only static preview server with a four-file allowlist.
- `docs/`: supplied context, implementation plan, and verification record.

## Integration checklist

- Replace temporary wordmark/favicon with the original licensed brand asset.
- Confirm chat, sign-in, API docs, model catalog, support, and legal URLs before adding production links.
- Confirm provider permissions and actual supported model IDs. The diagram uses task categories rather than unverified model logos.
- Confirm eSewa/Khalti merchant and payment availability. This frontend processes no payments.
- Confirm tariffs, credit units, package bonus totals, expiry and refund conditions. No pack prices are invented.
- Confirm endpoint, API auth, request compatibility, and model ID; then test and replace the illustrative cURL request.
- Replace availability/concept copy with verified product facts when integrations are ready.

No backend, authentication, account dashboard, payment gateway, or live model integration is included. The B2B review remains reference material for a separate implementation scope. Nothing has been published.
