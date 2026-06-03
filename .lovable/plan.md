## Branding update with Prottoy Foundation logo

Use the uploaded `header@4x.png` (green logo + Bangla wordmark on patterned background) as the primary brand asset, and update colors to match the logo's deep green.

### Assets
- Upload `header@4x.png` to Lovable Assets CDN → `src/assets/header.png.asset.json`.
- Also create a square logo-only crop for favicon + sidebar icon → `src/assets/logo.png.asset.json` (cropped from the same image via ImageMagick).

### Theme (index.css)
Shift the primary palette to the logo's green:
- `--primary: 150 60% 22%` (deep green ~#1f6b46)
- `--primary-foreground: 0 0% 100%`
- `--ring: 150 60% 22%`
- Add `--brand-green` token for accents.
- Keep light/dark mode structure; only swap primary hues.

### Layout / UI
- `src/components/AppLayout.tsx`: replace the text-only sidebar header with the logo image + "Prottoy Foundation" title. Same on the mobile top bar.
- `src/pages/Auth.tsx` & `src/pages/Signup.tsx`: show the full header banner image above the card title.
- `index.html`: update `<link rel="icon">` to the new favicon (cropped logo PNG written to `public/favicon.png`), remove the old `favicon.ico`.

### Out of scope
- No changes to data, routes, or business logic.
- App name text stays "Prottoy Foundation" (already set).
