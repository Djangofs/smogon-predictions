# Prediction Tournament Dashboard – Handoff Context

## Project goal
Build a static React + TypeScript dashboard to track player performance in a Smogon-style predictions tournament. The app consumes generated JSON data rather than a live backend, and is designed to be deployable as a static site.

## Current stack
- React + TypeScript
- Vite
- Node 22
- Static generated dataset pipeline

## Core workflow
- Raw weekly prediction files live under `data/predictions/`
- Raw weekly result files live under `data/results/`
- `scripts/generate-data.mjs` parses and normalizes those files into `public/data.json`
- `src/App.tsx` renders the dashboard from the generated JSON

## Source data layout
The project now uses week-based folders and file naming like:
- `data/predictions/week1.csv`
- `data/predictions/week2.csv`
- `data/results/week1.txt`
- `data/results/week2.txt`

This is the canonical structure used by the generator.

## Data model
The generated data set is a single public JSON object used by the frontend. It includes:
- `title`
- `weeks`
- `formats`
- `totalPredictors`
- `totalMatchups`
- `overallResults`
- `weeklyResults`
- `formatResults`
- `matchupPredictions`

The key fact that matters for the app is this:
- the tournament is scored by individual player-vs-player matchup slots
- team blocks are metadata/wrappers, not the actual units being scored
- each week includes 50 matchup slots, and the app expects 100 total matchups across weeks 1 and 2

## Important parsing fixes already implemented
These were essential to get real Smogon forum data working:

### 1. CSV and file parsing
- Auto-detect tab-separated vs comma-separated prediction data
- Support the real file layout under `data/predictions/` and `data/results/`
- Resolve week numbers from filenames like `week1.csv` / `week2.txt`

### 2. BBCode result parsing
- Parse forum result exports in native BBCode format
- Strip markup like `[B]`, `[USER=...]`, `[IMG]`, etc.
- Extract team matchups and then per-format slot lines such as `SV OU:` or `SV Ubers:`
- Identify the bolded player as the actual winner

### 3. Matchup normalization and alias handling
- Normalize names like `Mt. Silver Foxes` -> `MSF`
- Normalize `Power Plant Dynamos` -> `PD`
- Normalize `MF` to `MSF`
- Preserve actual player-vs-player matchup identities instead of team-only groupings
- Prevent false positives from substitute/void matchups by checking slot and matchup identity

### 4. Aggregate scoring logic
- Score each predictor against actual winners from the result data
- Track correct/incorrect totals per predictor
- Track per-week and per-format aggregates
- Build matchup prediction distributions for each slot

## Important bug fixes already made during this session
The project had several genuine data mismatches, which were resolved:

1. Node version mismatch
   - The app needed Node 22 for Vite/ESM compatibility.

2. Team-vs-team mismatch in the raw result model
   - The original logic treated team blocks as the core matchup unit.
   - The actual tournament logic is player-vs-player for 50 matchups per week.
   - This was corrected in the generator.

3. Week 2 being silently dropped
   - The main root cause was that the prediction column list was built from only the first CSV row, so week 2 matchup headers were never included in the scan.
   - This was fixed by using the union of all prediction headers from all weeks.

4. Team abbreviation collapse bug
   - Abbreviation logic could reduce names like `PD` and `MSF` to a single letter or incorrect short form.
   - This was fixed to preserve multi-letter abbreviations while still abbreviating multi-word team names appropriately.

## Current app behavior
The dashboard currently includes:
- Overview tab with summary stats and leaderboard
- Predictions tab with matchup distribution tables
- Week and format filters
- Search support
- Sort options for prediction rows

The leaderboard is currently ordered by:
1. correct predictions
2. difference
3. percentage

The leaderboard table has separate columns for:
- Correct
- Incorrect

## Data validation status
Fresh verification succeeded with:

```bash
npm run generate:data && npm run build
```

This produced:
- 128 predictors
- 100 matchup summaries
- per-week counts of 50 matchups in week 1 and 50 matchups in week 2

This means the generator and build pipeline are currently in a good state.

## Relevant files
- `README.md` — general project overview
- `scripts/generate-data.mjs` — data generation and normalization logic
- `public/data.json` — generated runtime dataset
- `src/App.tsx` — UI logic and dashboard rendering
- `src/App.css` — styling
- `data/predictions/` — raw weekly predictions
- `data/results/` — raw weekly result exports

## Suggested next work items for another agent
1. Review the generated `public/data.json` for edge-case anomalies and confirm the full leaderboard/per-week values look right.
2. If needed, add a small validation script to assert each week has 50 matchup slots and the totals match the source result files.
3. Consider adding a small UI note or legend explaining that team names are only wrappers and actual scoring is by slot-based player matchups.
4. If the data set grows, consider making the generator more defensive around malformed result rows and unsupported forum formatting.

## Hand-off notes
This project is in a good state for further iteration. The biggest architectural decision already made is that the app is driven by a generated static dataset, which keeps the deployment very simple and makes data fixes easy to validate via the generator script.
