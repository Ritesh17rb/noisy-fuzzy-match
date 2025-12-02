# Noisy Entity Matcher (Hungarian + Fuzzy)

A minimal, pure front-end app to optimally match two noisy lists of strings. It builds a similarity matrix using fuzzy string metrics and solves the global assignment with the Hungarian algorithm, supporting manual lock constraints and tunable thresholds.

## What This Does
- Computes string similarity (0?100) between every pair in List A and List B using `fuzzball`.
- Runs a global optimization (`linear-sum-assignment`) to select the best non-overlapping pairs that maximize total similarity.
- Lets you add manual "locks" (A = B) that the optimizer must respect.
- Shows optimized matches and items that remain unmatched.
- Provides settings to choose fuzzy metric (`ratio`, `token_sort_ratio`, `token_set_ratio`) and a minimum score threshold.

## How It Works (Overview)
- Build cost/similarity matrix `M[i][j] = fuzz(a_i, b_j)`.
- Exclude locked items from the open sets so the algorithm never reassigns them.
- Solve the assignment on the open sets with the Hungarian algorithm in "maximize" mode.
- Combine manual locks (score=100) + algorithmic matches; filter by `threshold`; sort by score.
- Compute `unmatchedSource` and `unmatchedTarget` as leftovers not in any match.

## Algorithms
- Hungarian Algorithm (a.k.a. Kuhn?Munkres): finds a maximum-weight matching on a bipartite graph in `O(n^3)` time. Here `n = max(|openA|, |openB|)`.
- Fuzzy String Similarity (from `fuzzball`): returns a score 0?100.
  - `ratio`: simple Levenshtein-like character comparison; sensitive to order and extra words.
  - `token_sort_ratio`: tokenizes words, sorts and compares; handles reordering (e.g., "Google Inc" vs "Inc Google").
  - `token_set_ratio`: focuses on overlapping tokens; good when one string is a subset of the other (e.g., "United States of America" vs "United States").

## Tech Stack / Libraries
- UI & rendering: `lit-html` (CDN ESM)
- Alerts: `bootstrap-alert` (CDN) with Bootstrap styling
- Layout: Bootstrap 5 (CDN)
- Matching:
  - `linear-sum-assignment` (ESM via CDN): Hungarian algorithm
  - `fuzzball` (ESM via CDN): similarity scores
- No build steps; uses import maps and CDN ESM modules directly.

## Files
- `index.html`: Bootstrap layout, dark-mode toggle, settings (ratio, threshold), editor and output containers.
- `script.js`: Core logic: similarity matrix, Hungarian assignment, manual locks, editor tables, alerts, rendering.
- `config.json`: Demo cards configuration and default settings. Edit this to add/remove demos.

## UI Flow
- Open `index.html` in a browser.
- Click a demo card or "Start Fresh" to load data into the editor.
- Edit items inline in the tables; add/remove locks.
- Set Fuzzy Ratio and Min Score Threshold.
- Click `Run` to compute optimized matches; review unmatched lists.

## Configuration (config.json)
Example demo entry:
```json
{
  "demos": [
    {
      "icon": "bi bi-person-lines-fill",
      "title": "People Names",
      "body": "Match noisy person names",
      "listA": ["John Smith", "Jane Doe"],
      "listB": ["Jon Smyth", "J. Doe"],
      "locks": [["Jane Doe", "J. Doe"]]
    }
  ],
  "defaults": { "ratio": "token_sort_ratio", "threshold": 60 }
}
```
- `listA`, `listB`: arrays of strings (items to match)
- `locks`: array of pairs `[A, B]` that are forced matches
- `defaults.ratio`: one of `ratio`, `token_sort_ratio`, `token_set_ratio`
- `defaults.threshold`: 0?100; matches with lower scores are hidden

## Implementation Notes
- Manual locks remove those items from the open sets before running the Hungarian algorithm; locks are emitted with score=100.
- Threshold is applied after combining locks and algorithmic matches; very high thresholds will increase unmatched items.
- Complexity: Hungarian is cubic in list size; for large lists consider chunking or pre-filtering.

## Development
- No bundler or `npm install` required; everything is CDN?loaded.
- If your browser blocks `fetch` for local files, serve the folder (e.g., `python -m http.server`) and open `http://localhost:8000/index.html`.

## Extend
- Add new demos in `config.json`.
- Persist edited data via localStorage or export as JSON (optional enhancement).
- Swap in other fuzzy metrics or custom preprocessors (lowercasing, punctuation stripping).
