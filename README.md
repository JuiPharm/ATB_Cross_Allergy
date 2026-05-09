# BHH Cross Allergy Checker - Premium Graph UX v3

Static GitHub Pages web application for beta-lactam antibiotic cross-allergy screening.

## What changed in v3

- Reworked Graph as a **Clinical Focus Map** instead of a dense all-edge graph.
- Overview mode now shows only `DO_NOT_PRESCRIBE` edges to reduce visual clutter.
- Clicking a drug node keeps the user inside the Graph tab and opens a focus view.
- Focus view places the selected drug at the center, red-risk drugs on the left, and considered-safe drugs on the right.
- Added graph-side inspector with selected drug, risk counts, danger list, safe list, dropdown focus, and quick jump back to the result section.
- Improved mobile responsiveness for the Graph control panel and canvas.

## Files to upload to GitHub

Upload these files/folders to the root of your GitHub repository:

```text
index.html
.nojekyll
assets/
data/
README.md
```

`apps-script/` is optional and only needed if you later want to connect remote Google Sheets logging or an external API.

## GitHub Pages deployment

1. Go to your GitHub repository.
2. Upload or replace the files above.
3. Open **Settings → Pages**.
4. Set source to **Deploy from a branch**.
5. Select branch `main` and folder `/root`.
6. Save and wait for GitHub Pages to rebuild.
7. Open the GitHub Pages URL and hard refresh the browser with `Ctrl + F5`.

## Data source

The app reads data from:

```text
data/cross_allergy.json
```

No server is required for the main static version.
