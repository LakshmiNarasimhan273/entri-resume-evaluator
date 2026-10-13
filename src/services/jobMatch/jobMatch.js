import { COURSE_CONFIG } from "../../config/resumeConfig.js";
import { termPresent, prettySkill } from "../analysis/structure.js";
import { evidenceToolPool } from "../analysis/sections.js";
import { uniq } from "../analysis/text.js";

/* Extra, role-agnostic skills that commonly appear in job descriptions. */
const COMMON_SKILLS = [
  "typescript", "redux", "tailwind", "bootstrap", "sass", "next", "graphql", "postman", "jira", "agile", "scrum",
  "docker", "aws", "azure", "gcp", "kubernetes", "ci/cd", "jest", "mongoose", "postgresql", "mysql", "sql", "nosql",
  "rest api", "api", "jwt", "oauth", "websocket", "responsive design", "html", "css", "javascript", "git", "github",
  "linux", "python", "java", "c++", "django", "flask", "fastapi", "tableau", "power bi", "excel", "pandas", "numpy",
  "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "figma", "wireframing", "prototyping",
  "user research", "flutter", "dart", "firebase", "selenium", "playwright", "cypress", "siem", "owasp", "data visualization", "etl", "statistics",
];

// Too generic to be a meaningful "skill" match.
const GENERIC = new Set(["responsive", "authentication", "crud", "database", "frontend", "backend", "deployment", "ui", "ux"]);

const STOP = new Set(
  ("the and for with you your our are will have has this that from they their them been being able into over such " +
    "more most other than then also both each very must should would could shall may can who what when where which " +
    "about across after again against all any because before between but does done during few how its just like make " +
    "many much need needs only own same some than these those through under until upon use used using via well while " +
    "within without work working works role roles team teams candidate candidates company join looking seeking strong " +
    "good great excellent ability skills skill knowledge experience experienced years year plus preferred required " +
    "requirements responsibilities responsibility qualifications qualification description job position opportunity " +
    "etc including include includes related relevant understanding familiarity proficiency proficient hands basic " +
    "bachelor degree communication").split(/\s+/),
);

/** Make spelling variants comparable: React.js / ReactJS -> react, REST APIs -> rest api, etc. */
function canon(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\b(react|node|express|next|vue)\s*\.?\s*js\b/g, "$1")
    .replace(/\breactjs\b/g, "react")
    .replace(/\bnodejs\b/g, "node")
    .replace(/\bexpressjs\b/g, "express")
    .replace(/\bmongo\s+db\b/g, "mongodb")
    .replace(/\brestful\b/g, "rest")
    .replace(/\brest\s+apis?\b/g, "rest api")
    .replace(/\bapis\b/g, "api")
    .replace(/\bci\s*\/\s*cd\b/g, "ci/cd")
    .replace(/\bpower\s*bi\b/g, "power bi")
    .replace(/\bjs\b/g, "javascript");
}

let VOCAB = null;
function vocabulary() {
  if (VOCAB) return VOCAB;
  const set = new Set(COMMON_SKILLS);
  for (const [course, cfg] of Object.entries(COURSE_CONFIG)) {
    evidenceToolPool(course).forEach((x) => set.add(x));
    for (const role of Object.values(cfg.roles)) {
      // Only concrete skills/tools - generic concepts ("crud", "database") would add noise.
      [...(role.must || []), ...(role.alt || []).flat()].forEach((x) => set.add(x));
    }
  }
  VOCAB = [...set].filter((x) => x && x.length > 1 || x === "r");
  return VOCAB;
}

const LABELS = {
  "ci/cd": "CI/CD", api: "REST API", "rest api": "REST API", typescript: "TypeScript", aws: "AWS", gcp: "GCP",
  jest: "Jest", docker: "Docker", kubernetes: "Kubernetes", nosql: "NoSQL", graphql: "GraphQL", jwt: "JWT",
  oauth: "OAuth", nlp: "NLP", etl: "ETL", siem: "SIEM", next: "Next.js", tailwind: "Tailwind CSS",
  postgresql: "PostgreSQL", tensorflow: "TensorFlow", pytorch: "PyTorch", fastapi: "FastAPI", redux: "Redux",
  websocket: "WebSocket", postman: "Postman", jira: "Jira", agile: "Agile", scrum: "Scrum", django: "Django",
  flask: "Flask", java: "Java", "c++": "C++", sass: "Sass", bootstrap: "Bootstrap", mongoose: "Mongoose",
  selenium: "Selenium", playwright: "Playwright", cypress: "Cypress", azure: "Azure",
};
const label = (s) => LABELS[s] || prettySkill(s);

function keywordCandidates(jd, skillSet) {
  const counts = new Map();
  (canon(jd).match(/[a-z][a-z+#.-]{3,}/g) || []).forEach((w) => {
    w = w.replace(/[.-]+$/, "");
    if (w.length < 4 || STOP.has(w)) return;
    if ([...skillSet].some((s) => s === w || s.includes(w))) return; // already a skill
    counts.set(w, (counts.get(w) || 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
}

/**
 * Compare a job description with the evaluated resume.
 * Only wording present in the resume counts as a match; nothing is assumed.
 */
export function matchJobDescription(jdText, resume, { level } = {}) {
  const jd = canon(jdText);
  if (jd.replace(/\s+/g, " ").trim().split(" ").length < 12) {
    return { error: "Paste the full job description (at least a few lines) to get a useful match." };
  }
  const resumeText = canon(resume.text);
  const sections = Object.fromEntries(
    Object.entries(resume.sections || {}).map(([k, v]) => [k, canon(v)]),
  );

  const jdSkills = uniq(vocabulary().filter((t) => !GENERIC.has(t) && termPresent(jd, t)));
  // "api" is implied by "rest api"; avoid double-counting.
  const skills = jdSkills.filter((t) => !(t === "api" && jdSkills.includes("rest api")));

  const matched = [];
  const missing = [];
  for (const t of skills) {
    if (termPresent(resumeText, t)) {
      const where = ["skills", "projects", "experience", "summary"].filter((k) => termPresent(sections[k] || "", t));
      matched.push({ term: t, label: label(t), where });
    } else missing.push({ term: t, label: label(t) });
  }

  const keywords = keywordCandidates(jdText, new Set(skills));
  const kwMatched = keywords.filter((k) => termPresent(resumeText, k));
  const kwMissing = keywords.filter((k) => !termPresent(resumeText, k));

  if (!skills.length && !keywords.length) {
    return { error: "No recognisable skills or keywords were found in this description. Check that you pasted the requirements." };
  }

  const skillPct = skills.length ? matched.length / skills.length : null;
  const kwPct = keywords.length ? kwMatched.length / keywords.length : null;
  const score = Math.round(
    100 *
      (skillPct !== null && kwPct !== null ? skillPct * 0.75 + kwPct * 0.25 : skillPct !== null ? skillPct : kwPct),
  );

  const suggestions = [];
  const good = [];
  if (matched.length) good.push(`${matched.length} of ${skills.length} skills requested in the job description appear in the resume.`);

  const listedOnly = matched.filter((m) => m.where.length === 1 && m.where[0] === "skills");
  if (listedOnly.length)
    suggestions.push(
      `${listedOnly.map((m) => m.label).join(", ")} ${listedOnly.length === 1 ? "is" : "are"} only listed under Skills. Show where ${listedOnly.length === 1 ? "it was" : "they were"} used in a project or experience bullet.`,
    );
  const notInSkills = matched.filter((m) => !m.where.includes("skills") && m.where.length);
  if (notInSkills.length)
    suggestions.push(
      `${notInSkills.map((m) => m.label).join(", ")} ${notInSkills.length === 1 ? "appears" : "appear"} in the resume body but not in the Skills section. Add ${notInSkills.length === 1 ? "it" : "them"} there so ATS filters pick ${notInSkills.length === 1 ? "it" : "them"} up.`,
    );
  if (missing.length)
    suggestions.push(
      `Missing from the resume: ${missing.map((m) => m.label).join(", ")}. Add only skills you have genuinely used or learned; otherwise treat them as learning goals.`,
    );
  if (kwMissing.length)
    suggestions.push(`Job description keywords not found in the resume: ${kwMissing.join(", ")}. Use the ones that honestly describe your work.`);

  const yrs = (String(jdText).match(/(\d+)\s*\+?\s*(?:-\s*\d+\s*)?years?/i) || [])[1];
  if (yrs && Number(yrs) >= 2 && level && /fresher|0–2/i.test(level))
    suggestions.push(
      `The job description asks for ${yrs}+ years of experience. Your selected level is "${level}", so highlight projects and internships as practical evidence and apply with that in mind.`,
    );

  const rewrite = [];
  if (missing.length)
    rewrite.push({
      label: "Copy-ready skills to add (only if genuinely used)",
      note: "Delete any skill you cannot demonstrate.",
      text: `Technical Skills: ${missing.map((m) => m.label).join(", ")}`,
    });

  return {
    score,
    verdict: score >= 75 ? "Strong match" : score >= 50 ? "Partial match" : "Low match",
    tone: score >= 75 ? "good" : score >= 50 ? "warn" : "bad",
    matched,
    missing,
    keywords: { matched: kwMatched, missing: kwMissing },
    good,
    suggestions,
    rewrite,
  };
}
