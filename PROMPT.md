# Prompt (reusable)

Build a React (Vite) version of my Resume Evaluator HTML tool with identical output and scoring: course/role/level
form, PDF upload, page "camera copy" previews, 0–100 score, and eight section cards (what is written well,
suggestions, copy-ready rewrite, 1–5 stars).

Fixes required:
1. Skills section: treat BOTH formats as correct — (a) "Technical Skills", and (b) "Key Skills" as the main heading with
   "Technical Skills" and "Soft Skills" nested beneath it (used to save space). Do not suggest renaming the heading and
   remove the "skills section uses a lot of vertical space" correction. Nested sub-headings must not be treated as new
   sections or as non-standard headings.
2. Project description: the copy-ready text must never be identical to (or a trivial restatement of) the resume text.
   Produce an improved, action-led description; flag missing objective/result/impact with [bracketed] prompts; never invent
   metrics; if nothing can be improved, show no copy-ready card.

Extras: drag-and-drop upload, section filter, score overview, copy/download full report.
