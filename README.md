# BHH Cross Allergy Checker — Premium UI v2

Static GitHub Pages web application for beta-lactam antibiotic cross-allergy screening support.

## What changed in Premium UI v2

- Redesigned visual system with Bangkok Hospital style: navy / blue / red / white / gray.
- Better clinical hierarchy: safety alert, search area, result cards, database, graph, reference.
- Mobile-first responsive layout.
- Table converts into mobile cards on small screens.
- Improved search box, suggestions, buttons, badges, result cards, graph panel, and empty states.
- Added accessible labels, skip link, focus states, and reduced-motion support.
- Kept static JSON mode for GitHub Pages; no server required.

## Files to upload to GitHub

Upload these files/folders to the repository root:

```text
index.html
.nojekyll
README.md
assets/
data/
```

Optional if you want live Google Sheets / Apps Script later:

```text
apps-script/
```

## Deploy to GitHub Pages

1. Open your GitHub repository.
2. Upload all files above to the repository root.
3. Go to **Settings > Pages**.
4. Source: **Deploy from a branch**.
5. Branch: **main**.
6. Folder: **/ root**.
7. Click **Save**.
8. Open the GitHub Pages URL after deployment finishes.

## Data mode

Default mode is static JSON:

```js
window.APP_CONFIG = {
  USE_REMOTE_API: false,
  LOCAL_DATA_URL: "data/cross_allergy.json"
}
```

To use Google Apps Script later:

1. Deploy `apps-script/Code.gs` as Apps Script Web App.
2. Set `GAS_API_URL` in `assets/js/config.js`.
3. Change `USE_REMOTE_API` to `true`.
4. Set `ENABLE_REMOTE_LOGGING` to `true` only if you want to log searches remotely.

## Clinical notice

This tool is for medication safety screening support only. Final prescribing decisions must follow hospital policy and clinician/pharmacist judgment.
