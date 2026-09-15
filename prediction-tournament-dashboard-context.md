# Prediction Tournament Dashboard — Context & Design Specification

## Purpose

This project is a static web dashboard for analysing a prediction tournament.

The tournament is expected to run for roughly 11 weeks, with approximately 100 prediction submissions per week. The dashboard should make it easy to answer:

- How is each predictor performing overall?
- How did predictors perform in a particular week?
- How does performance differ by format?
- What did people predict for each matchup?
- What actually happened in each matchup?
- Which results were the biggest upsets?

The application should be designed as a clean esports/sports analytics dashboard rather than as a spreadsheet.

---

## Data and deployment model

For the initial version there is **no API, database, authentication, or server-side application**.

The workflow will initially be:

```text
Raw prediction file ──┐
                      ├──> Local build script ──> generated data.json
Results file ─────────┘                                │
                                                       ↓
                                              Static web application
                                                       │
                                                       ↓
                                                   Git commit
                                                       │
                                                       ↓
                                                  GitHub Pages
```

The user will manually update the input files and run a local script which:

1. Reads the raw prediction data.
2. Reads the results data.
3. Normalises/calculates the data required by the frontend.
4. Generates `data.json`.
5. The user commits and pushes the changes.

Automation of the data update/deployment process can be added later and should not be required by the initial architecture.

The dataset is small enough that the complete generated `data.json` can be loaded by the browser in one request. Client-side filtering, sorting and navigation are expected to be effectively instantaneous.

---

# Input data

There are two initial inputs:

1. **Raw predictions**
2. **Results**

Both are read from files.

The raw prediction input is currently spreadsheet/CSV-like data. It contains identifying columns such as:

- Username
- User ID
- Profile
- Submitted
- Discord username

followed by prediction columns.

The prediction columns encode the tournament format and matchup in their column titles. For example, the existing data contains columns following patterns such as:

```text
SV OU 1 [IP v SS]
SV OU 2 [IP v SS]
...
SV LC [IP v SS]
...
```

Other groups of columns represent other matchups/teams and formats.

**Do not hard-code the format list if it can be derived reliably from the input column titles.**

The input parsing/build layer should be responsible for converting the wide raw prediction format into a clean internal representation.

---

# Recommended project structure

A simple initial structure is preferred:

```text
prediction-dashboard/
│
├── input/
│   ├── predictions.csv
│   └── results.csv
│
├── src/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── build/
│   └── build-data.js
│
├── public/
│   └── data.json
│
└── package.json
```

The exact structure can change if the coding agent has a strong reason, but the separation of concerns should remain:

- input files = source data
- build script = parsing, normalisation and calculations
- `data.json` = generated frontend dataset
- frontend = presentation, navigation, filtering and sorting

---

# Core frontend navigation

Use a **single-page dashboard** with persistent top-level navigation.

Recommended navigation:

```text
OVERVIEW   RESULTS   WEEKLY   FORMATS   PREDICTIONS   MATCHUPS
```

The navigation should remain accessible while scrolling (sticky header/navigation is preferred).

The application should feel like one coherent dashboard rather than six disconnected pages.

---

# Global controls

Use consistent controls throughout the application.

Common controls should include:

```text
Week       [ All Weeks ▼ ]
Format     [ All Formats ▼ ]
Search     [________________]
```

Not every view needs every control.

Examples:

### Results

```text
Overall / Week selector
Search predictor
```

### Formats

```text
Format: [ SV OU ▼ ]
Week:   [ All ▼ ]
```

### Predictions

```text
Week:   [ Week 3 ▼ ]
Format: [ All Formats ▼ ]
Sort:   [ Most predicted ▼ ]
```

### Matchups

```text
Week:   [ Week 3 ▼ ]
Format: [ All Formats ▼ ]
Sort:   [ Biggest upset ▼ ]
```

Controls should update the current view without requiring unnecessary page reloads.

---

# 1. Overview

The Overview page is the landing page.

Its purpose is to answer:

> "How is everyone doing overall?"

## Header

Display the tournament name and basic context.

Example:

```text
Prediction Tournament
11 Weeks · 5 Formats
```

## Summary statistics

Show a small number of high-level metrics.

Example:

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 100          │ │ 52           │ │ 68.4%        │ │ 11           │
│ Predictors   │ │ Matchups     │ │ Avg Accuracy │ │ Weeks         │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

The exact metrics should be based on the available data.

## Overall leaderboard

Show the overall predictor results table.

Required columns:

| Rank | ID | Name | Raw record | Dif | % |
|---:|---|---|---:|---:|---:|

Default sorting should be by percentage descending, with sensible tie-breaking.

The table should support sorting where practical.

---

# 2. Results

The Results view is the detailed predictor leaderboard.

It should support:

```text
[ Overall ] [ Week 1 ] [ Week 2 ] [ Week 3 ] ... [ Week N ]
```

The same table structure is used for overall and weekly results.

Required columns:

| Rank | ID | Name | Raw record | Dif | % |
|---:|---|---|---:|---:|---:|

The page should support searching/filtering predictors.

The distinction is:

- **Results** = predictor leaderboard
- **Weekly** = broader "what happened this week?" dashboard

Avoid duplicating unnecessary functionality between these views.

---

# 3. Weekly

The Weekly view is intended to answer:

> "What happened this week?"

Provide a week selector:

```text
[ Week 1 ▼ ]
```

## Weekly highlights

Show useful automatically-derived facts, for example:

```text
┌──────────────────────────────────────────────────────────────┐
│ WEEK 1 HIGHLIGHTS                                            │
│                                                              │
│ Most predicted player      Player A       91%                │
│ Biggest upset              Player B       19% predicted      │
│ Closest matchup            Player C/D     51% / 49%          │
│ Most accurate predictor    Player E       82%                │
└──────────────────────────────────────────────────────────────┘
```

Only show metrics that can be calculated reliably from the source data.

## Weekly leaderboard

Use the standard result table:

| Rank | ID | Name | Raw record | Dif | % |
|---:|---|---|---:|---:|---:|

## Weekly matchup summary

Below the leaderboard, provide a concise breakdown of matchups, with optional format filtering.

This view should make it easy to move from:

```text
Week → overall performance → matchup events
```

---

# 4. Formats

The Formats view provides predictor results for an individual tournament format.

Do **not** render every format as a huge table simultaneously.

Instead use selectors:

```text
Format: [ SV OU ▼ ]
Week:   [ All ▼ ]
```

Then display the leaderboard for that selection.

Required table:

| Rank | ID | Name | Raw record | Dif | % |
|---:|---|---|---:|---:|---:|

This should support:

- format overall
- format + individual week

The list of formats should preferably be derived from the prediction column titles rather than manually maintained.

---

# 5. Predictions

The Predictions view answers:

> "What did people predict?"

The primary unit is a **matchup**, not a predictor.

Controls:

```text
Week:   [ Week 3 ▼ ]
Format: [ All Formats ▼ ]
```

For every matchup, show:

- matchup
- each possible player
- raw number of predictions
- percentage of predictions
- actual result if available

A compact matchup presentation is preferred over unnecessarily repetitive table rows.

Example:

```text
IP vs SS                                      100 predictions

IP   ██████████████████████████████████████░░  73%
SS   ███████████████░░░░░░░░░░░░░░░░░░░░░░░░  27%

Result: IP ✓
```

A conventional table can also be used where appropriate:

| Matchup | Player | Predicts | % |
|---|---|---:|---:|
| IP vs SS | IP | 73 | 73% |
| IP vs SS | SS | 27 | 27% |
| MF vs SG | MF | 51 | 51% |
| MF vs SG | SG | 49 | 49% |

Useful sorting options:

```text
Most predicted
Closest
Biggest upset
Format
```

The "Closest" option should surface matchups where the prediction distribution was closest to 50/50.

---

# 6. Matchups

The Matchups view is the forensic/results view.

Its purpose is to answer:

> "What actually happened in every match?"

and support questions such as:

> "What was the biggest upset from Week 1?"

Controls:

```text
Week:   [ Week 1 ▼ ]
Format: [ All Formats ▼ ]

Sort:
[ Biggest upset ]
[ Closest predictions ]
[ Most predicted ]
[ Match order ]
```

## Matchup table

Default presentation should be a dense table rather than dozens of large cards.

Suggested columns:

| Format | Matchup | Result | Predict % | Accuracy | Upset |
|---|---|---|---:|---:|---|
| SV OU | IP vs SS | SS | IP 73% | 27% | High |
| SV OU | AA vs BB | AA | AA 61% | 61% | Low |
| SV UU | CC vs DD | DD | CC 52% | 48% | Medium |

The exact terminology for "upset" should be determined by the data model/calculation, but it should reflect how unexpected the result was based on prediction percentages.

## Expandable matchup detail

Clicking a matchup row should expand it rather than navigating to another page.

Example:

```text
SV OU 1 · IP vs SS

Prediction
IP █████████████████████████████████████ 73%
SS ██████████████                        27%

Result
SS

73% of predictors backed IP, but SS won.

Predictors correct: 27 / 100
Predictors incorrect: 73 / 100
```

This provides detailed information without cluttering the main table.

---

# Result table conventions

All predictor result tables should consistently use these columns:

1. **Rank**
2. **ID**
3. **Name**
4. **Raw record**
5. **Dif**
6. **%**

Do not invent alternative representations for different views unless there is a strong UX reason.

The same terminology should be used everywhere.

---

# Visual design direction

The desired visual style is:

**Clean esports/sports analytics dashboard.**

Avoid making the application look like a raw spreadsheet.

Recommended characteristics:

- dark-ish neutral background or similarly restrained professional theme
- cards for summary metrics
- clear table hierarchy
- sticky table headers
- subtle row separation
- restrained use of accent colours
- colour used primarily to communicate:
  - wins/correct predictions
  - losses/incorrect predictions
  - notable upsets
  - strong/weak accuracy
- compact controls
- responsive layout
- generous but efficient spacing
- highly readable typography

Do not overuse charts. Most of the important information is naturally tabular.

---

# Data architecture

The frontend should not need to understand the original wide spreadsheet structure.

The build script should transform the raw inputs into a normalised/generated dataset.

A conceptual generated structure could be:

```json
{
  "weeks": [],
  "formats": [],
  "predictors": [],
  "overallResults": [],
  "weeklyResults": {},
  "formatResults": {},
  "predictions": {},
  "matchups": {}
}
```

The exact schema should be designed by the coding agent based on the real input files.

The important principle is:

> **Do the expensive/complex interpretation and aggregation at build time. Keep the frontend primarily responsible for presentation and interaction.**

The generated data should contain everything needed to render the dashboard without additional server requests.

---

# Build-time calculations

The build layer should be responsible for calculations such as:

- identifying weeks
- identifying formats from input headers
- identifying matchups
- normalising predictor identity
- calculating overall records
- calculating weekly records
- calculating per-format records
- counting predictions per player
- calculating prediction percentages
- associating predictions with actual results
- calculating matchup prediction accuracy
- calculating upset strength/ranking
- calculating weekly highlights

The browser should then be able to perform simple operations such as:

- filtering
- sorting
- searching
- changing week/format
- expanding matchup rows
- switching navigation views

---

# Performance expectations

The expected data volume is approximately:

```text
~100 predictors
× ~50 prediction values/week
× ~11 weeks
≈ ~55,000 prediction values
```

This is extremely small for a static web application.

Therefore:

- a single `data.json` load is acceptable
- client-side filtering is preferred
- client-side sorting is preferred
- no database is required
- no API is required
- no pagination is necessary unless it becomes useful for UX
- no backend runtime is required

The application should feel instantaneous.

---

# MVP priorities

Build the following first:

1. Input parsing for prediction and result files
2. Generated `data.json`
3. Overall results
4. Weekly results
5. Format results
6. Predictions
7. Matchups
8. Persistent navigation
9. Week/format filtering
10. Search/filtering of predictors

Then add:

11. Weekly highlights
12. Expandable matchup details
13. More sophisticated sorting
14. Individual predictor drill-down
15. Additional visualisations

Do not over-engineer the initial version.

---

# Important implementation principles

### Keep raw data separate from generated data

The source files should remain untouched by the frontend.

### Make the build repeatable

Running the build script against updated input files should deterministically regenerate `data.json`.

### Avoid hard-coded tournament data

Where possible, derive:

- weeks
- formats
- matchup names
- players
- predictor identities

from the input files.

### Keep presentation separate from data processing

Do not bury complex prediction/result calculations inside UI components.

### Design for future automation

The initial process is deliberately manual:

```text
edit source files
→ run build
→ inspect result
→ commit
→ push
```

But the architecture should make it straightforward to later replace the manual step with a GitHub Action or another automated process.

### Keep the UI extensible

The initial navigation and data model should make it possible to add future analytics without redesigning the entire application.

Potential future features include:

- individual predictor profiles
- predictor performance over time
- prediction streaks
- format strengths/weaknesses
- most/least predictable players
- biggest upsets
- closest matchups
- accuracy trends
- historical weekly charts

These are future considerations, not requirements for the first implementation.
