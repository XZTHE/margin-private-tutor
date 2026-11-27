# Margin — Interactive private tutor

Website: https://xzthe.github.io/margin-private-tutor/

Repository: https://github.com/XZTHE/margin-private-tutor

GitHub Actions built, tested and deployed the static app successfully on 2026-11-26. Live Gemini teaching remains unconfigured: Kevin credentials are not located and Worker free-tier billing must be confirmed.

React + TypeScript + Vite, PDF.js, SVG ink, IndexedDB, and a separately deployed Cloudflare Worker. No database, mandatory accounts, sync, or paid services. The project is independent of Kevin.

## Run locally

Requires Node 22+ and npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite prints the local preview URL. `dist/` is the static production build, with relative asset URLs for GitHub Pages repository paths.

## Implemented

- Local subjects, folders, documents, blank multipage notes, resource search and deletion.
- PDF.js page rendering and cached text extraction, local PNG/JPEG import, and basic PPTX rendering (OOXML positioned text, embedded PNG/JPEG, simple shape fills). Import files up to 40 MB.
- Pen and eraser, pressure-sensitive Pencil strokes through pointer events, typed annotations, text selection for PDFs, region selection, undo last stroke, page navigation, zoom, and separate persistent whiteboard notes. Fingers scroll; Pencil/mouse write.
- Subject-isolated local keyword retrieval with filename/page references and current-page priority. Current page is sent as a reduced JPEG only on explicit requests. Student ink is included in that snapshot; Practice includes stroke coordinates too.
- Explain, Solve Together (one hint then wait), and Practice (explicit review only).
- Validated teaching commands, progressive text/equations, shapes, pause/resume, previous step, adjustable speed, keep/discard AI ink, interruption and chat. Commands use normalized page coordinates. Editing AI ink: keep the lesson ink, then erase individual elements or add replacement text.
- Independent English/Arabic conversation, explanation, and writing preferences; RTL chat and automatic text direction for ink.
- IndexedDB persistence including source files, extracted text, strokes, conversations and lesson progress. Versioned JSON backups include original file bytes.
- Proxy bearer authentication, constant-time token comparison, exact CORS origin, native Worker rate limiter, output validation, bounded requests/output, upstream timeouts, no automated retries or model fallback. The private token lives in React memory for the session. Gemini key is never in browser code.

## GitHub Pages deployment

1. Create a dedicated repository named `margin-private-tutor` in your GitHub account; upload this directory **without** node_modules, dist, local env files, or secrets.
2. Set the default branch to `main`.
3. Repository Settings → Pages → Source: **GitHub Actions**.
4. Push to main. `.github/workflows/pages.yml` installs from the lockfile, runs tests/build, and deploys the `dist` artifact. A public repository is generally the free GitHub Pages route; verify account eligibility and usage rules before enabling hosting.
5. The action reports the actual Pages URL; do not assume a URL is live before that action succeeds.

GitHub Pages is configured to deploy through GitHub Actions. The initial CI run passed all 12 automated tests and deployed successfully. Source was uploaded using the signed-in browser because the terminal Git credentials belong to another account.

## Secure free-tier Gemini proxy

Kevin configuration was not found in the accessible local directories or in a Kevin repository under the connected GitHub account. No credentials were invented or copied. To reuse Kevin, locate the project and inspect its configuration names/model without printing or committing its secrets.

1. Use a Cloudflare **Workers Free** account and a Gemini API project with **no paid billing enabled**. App code cannot verify or override your provider billing configuration.
2. Edit `worker/wrangler.toml`: set `ALLOWED_ORIGIN` to the exact website origin (no path), select a currently available free-tier multimodal structured-output model, then set `FREE_TIER_CONFIRMED = "true"` only after verifying billing.
3. Default model: `gemini-3.5-flash-lite`, listed with free text/image input and output and structured outputs in Google's model documentation when checked on 2026-11-26. Availability and quotas vary by project/region. Never configure a paid model or enable billing as fallback.
4. Authenticate Cloudflare and add secrets interactively:

```sh
npx wrangler login
npx wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
npx wrangler secret put ACCESS_TOKEN --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

Use a long random proxy access token. Do not enter your Gemini key into app settings. For private testing, share the proxy token only with authorized students; a public secret embedded in a static frontend would not protect usage. Origin checks complement bearer authentication; they do not replace it. Native Worker rate limiting is per Cloudflare location and is not a strict global budget. The no-billing Gemini project is the final cost boundary. The proxy makes no paid fallback requests or background model requests, and returns a clear error on 429.

5. In app Settings, enter the Worker URL and proxy access token. Enable AI in a document and ask a question. Preferences persist, token does not.

For local Worker development, keep secrets in ignored `worker/.dev.vars` and use `npx wrangler dev --config worker/wrangler.toml`; allow only `http://localhost:5173` or your actual Vite origin in the local configuration. Never commit `.dev.vars`.

## Verification

Automated tests cover cross-subject isolation, command validation, playback visibility/erase behavior, and binary backup round trips. Production build is checked with TypeScript. Browser smoke testing covers library rendering, note creation, workspace controls, and IndexedDB refresh persistence. GitHub Pages deployment passed in CI and the public URL was verified. No successful Gemini response or Cloudflare deployment can be verified without the missing external setup. No generated tutor responses are shown as real API results.

Manual acceptance:

1. Create two subjects; import a PDF and an image into one. Create a note and draw with Pencil/mouse, erase and undo, add text, change zoom and pages, refresh and reopen.
2. Select PDF text or a region. Turn AI off: submitting must send nothing. Configure a Worker then enable AI and ask a question; check source citations and subject isolation.
3. Pause halfway through a line, resume, go back, change speed, and ask why. Try Solve Together and request a Practice review. Confirm the original imported page remains intact.
4. Export a backup, restore it, and verify imported documents and ink.
5. Check iPad Safari in both orientations and physical Pencil input. Those physical-device checks have not yet been performed.

## Known limits

This is a working foundation, not a completed acceptance of every requested feature. PPTX does not yet fully preserve masters/themes, grouped transforms, charts, SmartArt, animations, complex wrapping, or equations encoded as Office Math. PDF text selection depends on embedded text; scanned PDFs and images are understood only on explicit multimodal requests, not OCR-indexed locally. Retrieval is lexical rather than semantic, and only the top six text excerpts are sent. Images from other documents are not included in cross-resource retrieval. Voice is deferred. English and Arabic interface labels with RTL shell layout are available; browser-native prompts and provider errors may remain English. SVG teacher lines animate progressively; circles and highlights appear per command. Teaching positions may overlap document content and can be erased. Browser storage is subject to quotas/eviction; keep backups. Large binary JSON backups temporarily increase memory use. The provider's free tier may use submitted content for product improvement; review Google's terms before sending sensitive notes.

References: [Gemini model](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite), [structured output](https://aistudio.google.com/docs/structured-output), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).

## Automatic iCloud Drive backup — local Mac only

The Vite development server can save an automatic backup to `iCloud Drive/Margin/library.json` on this Mac. Apple/macOS handles uploading the file through the user's existing iCloud Drive account. This is a local backup bridge, not CloudKit web sign-in; it does not require adding an Apple developer API key or buying a service. It runs only with `npm run dev` on loopback. The GitHub Pages build has no backup endpoint or filesystem access.

Open Settings → **iCloud Drive — الحفظ التلقائي** to see the last file write, pause backup, save now, or restore the latest/previous version. Changes are debounced for three seconds; unchanged snapshots are not rewritten. The existing browser IndexedDB copy remains in use. The backup contains subjects, imported source files, notes/ink, conversations, preferences and lesson progress. Gemini credentials remain session-only and are omitted from backup preferences.

The file is written atomically, with `library.previous.json` retaining the previous successful snapshot. Revision checks reject stale tabs instead of replacing a newer backup. A newer cloud file or an empty browser library prompts restoration rather than automatic overwrite. Missing iCloud access, full storage and permission errors are shown in Settings. The app can verify writing the local iCloud Drive file; it cannot confirm Apple's server-side upload completion. Keep **Sync this Mac** enabled and enough iCloud storage available. No storage plan upgrades are activated.

This feature does not provide live automatic library synchronization to an iPad browser. After Apple uploads the file, it can be accessed through Files → iCloud Drive and imported as a Margin backup when needed. The local Mac server must remain running for further automatic backups.
