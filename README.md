# Professional Resume Evaluator (React + Vite)

React port of `Resume_Evaluator.html` — same scoring, same section-by-section output.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # evaluation-logic tests (Node, no browser needed)
npm run build    # production build in dist/
```

## Folder structure
```
resume-evaluator/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   └── favicon.svg
├── tests/
│   ├── fixtures/syntheticResume.js     fake parsed-PDF builder
│   └── evaluation.test.mjs             skills + project copy-ready tests
└── src/
    ├── main.jsx                        entry
    ├── App.jsx                         page composition + form state
    ├── components/
    │   ├── layout/Header.jsx
    │   ├── upload/UploadForm.jsx       form + drag-and-drop upload
    │   ├── preview/PagePreview.jsx     page "camera copy" thumbnails
    │   ├── common/  TabBar · BackToTop
    │   ├── jobmatch/JobMatch.jsx       Job Description Match tab
    │   └── results/
    │       ├── ResultsTabs.jsx         sticky tabs (Resume Evaluation | Job Description Match)
    │       ├── Results.jsx             filter + report wiring
    │       ├── ScoreHero.jsx           donut score + readiness
    │       ├── ScoreOverview.jsx       per-section bars, filter, copy/download
    │       ├── ReviewCard.jsx          one section review
    │       ├── Stars.jsx
    │       └── CopyButton.jsx
    ├── hooks/
    │   └── useResumeEvaluation.js      busy / status / pages / result lifecycle
    ├── services/                       all business logic (no React)
    │   ├── runEvaluation.js            pipeline: parse → structure → evaluate → repo check
    │   ├── pdf/parser.js               PDF.js + Tesseract OCR fallback
    │   ├── analysis/
    │   │   ├── skillGroups.js              grouped, role-ordered skills copy-ready (edit SKILL_GROUPS)
    │   │   ├── text.js                 text helpers, heading detection
    │   │   ├── structure.js            section detection, skills sub-headings
    │   │   └── sections.js             project blocks, quality checks, copy-ready builder
    │   ├── evaluation/evaluate.js      the 8 section reviews + scoring
    │   ├── jobMatch/jobMatch.js        resume vs job-description matching
    │   └── github/repoEvidence.js      verified quantification from public repos
    ├── config/resumeConfig.js          courses, roles, headings, weights
    ├── utils/
    │   ├── helpers.js
    │   └── report.js                   plain-text report export
    └── styles/
        ├── base.css                    original look
        └── components.css              new-feature styles
```

## Fixes in this version
1. **Skills headings** – `Key Skills` with nested `Technical Skills` / `Soft Skills`, and a flat `Technical Skills`
   heading, are both accepted. The rename suggestion and the "large vertical space" correction are removed; nested
   sub-headings are no longer mistaken for new sections (which used to cut the skills text short).
2. **Project copy-ready text** – no longer echoes the resume. It builds an improved description (weak openers such as
   "Worked on…" / "Helped to…" rewritten) and adds clearly marked `[bracketed]` prompts for a missing objective /
   result / impact. No numbers are invented. A project that already has everything gets no card.

## Tabs (as in your screenshots)
- **Resume Evaluation** – the 8 section cards.
- **Job Description Match** – paste a JD, get a match %, skills found/missing (with where they appear in the resume),
  keyword gaps, suggestions and a copy-ready skills line. Only skills genuinely in the resume count.
- Sticky tab bar and a **↑ Back to top** button.

## Extra features
Drag-and-drop upload · score overview bars (click to jump) · filter (All / Needs work / Strong) ·
copy full report · download report (.txt)

## Checks
- `npm test` – unit tests for the evaluation logic (skills layouts, project copy-ready, job match).
- `npx eslint src tests` – catches missing imports / undefined names.
- `tests/e2e/browser_flow.py` – optional Playwright run: uploads a sample PDF, checks tabs, Back to top and the JD match.

## PDF library loading
`src/services/pdf/loadLibs.js` loads pdf.js 3.11.174 (cdnjs) and Tesseract (jsdelivr) as plain scripts first.
If a CDN is blocked or offline it falls back to the copies bundled with the app.
