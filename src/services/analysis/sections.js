import { norm } from '../../utils/helpers.js';
import { CERT_ISSUER } from '../../config/resumeConfig.js';
import { cleanLine, hasActionVerb, rewriteBullet, uniq, isStandardHeading, recommendedHeading } from './text.js';
import { firstHit, normalizedMatchText, termPresent, prettySkill } from './structure.js';

function evidenceToolPool(course) {
  const map = {
    "Data Analytics": [
      "excel",
      "sql",
      "mysql",
      "python",
      "power bi",
      "tableau",
    ],
    "Data Science": [
      "python",
      "sql",
      "mysql",
      "pandas",
      "numpy",
      "scikit-learn",
      "tensorflow",
      "pytorch",
      "tableau",
      "power bi",
    ],
    FSD: [
      "html",
      "css",
      "javascript",
      "react",
      "node",
      "express",
      "mongodb",
      "git",
      "github",
    ],
    "Agentic FSD": [
      "html",
      "css",
      "javascript",
      "react",
      "node",
      "express",
      "mongodb",
      "git",
      "github",
    ],
    "Python Development": [
      "python",
      "sql",
      "mysql",
      "django",
      "flask",
      "fastapi",
      "git",
      "github",
    ],
    "UI UX": ["figma", "adobe xd", "photoshop", "illustrator"],
    Flutter: ["flutter", "dart", "firebase", "sqlite", "git", "github"],
    "Cyber Security": [
      "linux",
      "nmap",
      "wireshark",
      "burp suite",
      "splunk",
      "wazuh",
      "metasploit",
      "nessus",
    ],
  };
  return map[course] || [];
}
function sectionSpan(st, key) {
  const h = firstHit(st, key);
  if (!h) return null;
  const ordered = st.hits
    .filter((x) => x.page > h.page || (x.page === h.page && x.y > h.y))
    .sort((a, b) => a.page - b.page || a.y - b.y);
  const next = ordered[0] || null;
  if (!next || next.page !== h.page) return null;
  return Math.max(0, next.y - h.y);
}
function certNorm(s) {
  return norm(s)
    .replace(/[^\w\s/()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function validIssuer(text) {
  const t = certNorm(text);
  return (
    t.includes(certNorm(CERT_ISSUER)) ||
    t.includes(certNorm("Entri Software Pvt. Ltd."))
  );
}
function githubRoot(url) {
  try {
    const clean = /^https?:\/\//i.test(url)
      ? url
      : `https://${String(url).replace(/^www\./i, "")}`;
    const u = new URL(clean);
    if (!/github\.com$/i.test(u.hostname.replace(/^www\./i, "")))
      return null;
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg.length < 2) return null;
    return `https://github.com/${seg[0]}/${seg[1]}`;
  } catch (e) {
    return null;
  }
}
function githubRepoUrls(urls) {
  return uniq(
    (urls || []).filter((u) => {
      if (!/github\.com/i.test(u)) return false;
      if (
        /\/(commit|commits|blob|tree|pull|pulls|issues|actions|releases)\//i.test(
          u,
        )
      )
        return false;
      const root = githubRoot(u);
      if (!root) return false;
      try {
        const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
        return (
          x.pathname.split("/").filter(Boolean).length === 2 ||
          /\/$/.test(x.pathname)
        );
      } catch (e) {
        return false;
      }
    }),
  );
}
function invalidGithubProjectUrls(urls) {
  return uniq(
    (urls || []).filter(
      (u) =>
        /github\.com/i.test(u) &&
        /\/(commit|commits|blob|tree|pull|pulls|issues|actions|releases)\//i.test(
          u,
        ),
    ),
  );
}
function liveUrls(urls) {
  return (urls || []).filter((u) =>
    /vercel\.app|netlify\.app|onrender\.com|pages\.dev|firebaseapp\.com|web\.app|herokuapp\.com|railway\.app/i.test(
      u,
    ),
  );
}
function portfolioUrls(urls) {
  return (urls || []).filter((u) =>
    /behance\.net|dribbble\.com|figma\.com|notion\.site|portfolio|webflow\.io|framer\.website/i.test(
      u,
    ),
  );
}
function looksLikeProjectTitle(line) {
  const t = cleanLine(line.text || "");
  const w = t.split(/\s+/).filter(Boolean);
  if (!t || /^[-•▪◦*]/.test((line.text || "").trim())) return false;
  if (w.length < 2 || w.length > 20) return false;
  if (
    /^(tools?|technologies?|tech stack|duration|date|github|live|link|role|responsibilities?)\b/i.test(
      t,
    )
  )
    return false;
  if (hasActionVerb(t)) return false;
  if (t.includes("|")) return true;
  if (
    /\b(github|dashboard|analysis|prediction|classification|system|application|app|website|portal|design|case study|model|detector|scanner|platform|tracker|clone|manager|management|generator|chatbot|ecommerce|e-commerce|exchange|booking|store|game|tool|extension|api)\b/i.test(
      t,
    ) &&
    w.length <= 14
  )
    return true;
  return false;
}
// "SkillSwap – Community Learning Platform Live Demo" -> "SkillSwap – Community Learning Platform"
function cleanProjectTitle(t) {
  return (
    String(t || "")
      .replace(/\b(live demo|demo|github|source code|live link|live)\s*$/i, "")
      .replace(/[\s|–—-]+$/, "")
      .trim() || "Project"
  );
}
function splitProjectBlocks(lines) {
  const arr = (lines || []).filter((x) => cleanLine(x.text).length > 0);
  let titleIdx = [];
  arr.forEach((x, i) => {
    if (looksLikeProjectTitle(x)) titleIdx.push(i);
  });
  // Strongest signal: pipe-separated project title lines such as "Project | Tools | GitHub".
  const pipeIdx = titleIdx.filter((i) => arr[i].text.includes("|"));
  if (pipeIdx.length >= 1) titleIdx = pipeIdx;
  // Remove candidates that are immediately adjacent duplicates.
  titleIdx = titleIdx.filter(
    (i, k) => k === 0 || i - titleIdx[k - 1] > 1,
  );
  if (!titleIdx.length) {
    if (!arr.length) return [];
    // No recognisable title pattern: if the first line reads like a heading
    // (not a bullet, not an action sentence, short), use it as the title.
    const first = arr[0];
    const ft = cleanLine(first.text);
    const asTitle =
      !/^[-•▪◦*]/.test((first.text || "").trim()) &&
      !hasActionVerb(ft) &&
      ft.split(/\s+/).length <= 14;
    return [
      {
        title: asTitle ? cleanProjectTitle(ft) : "Project",
        lines: arr,
        page: first.page,
      },
    ];
  }
  return titleIdx.map((idx, k) => {
    const end = k < titleIdx.length - 1 ? titleIdx[k + 1] : arr.length;
    return {
      title: cleanProjectTitle(cleanLine(arr[idx].text).split("|")[0]),
      lines: arr.slice(idx, end),
      page: arr[idx].page,
    };
  });
}
function estimateProjects(lines) {
  const blocks = splitProjectBlocks(lines);
  return blocks.length;
}
function projectDateValue(text) {
  const months = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const t = norm(text);
  const y = [...t.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  if (!y.length) return null;
  const year = Math.max(...y);
  let month = 0;
  for (const [m, n] of Object.entries(months)) {
    if (new RegExp(`\\b${m}[a-z]*\\b`, "i").test(t)) {
      month = n;
      break;
    }
  }
  return year * 100 + month;
}
function projectQuality(block, roleCfg) {
  const txt = normalizedMatchText(
    block.lines.map((x) => x.text).join(" "),
  );
  const bullets = block.lines.filter(
    (x) =>
      /^[-•▪◦*]/.test((x.text || "").trim()) ||
      cleanLine(x.text).split(/\s+/).length >= 6,
  );
  const contribution = bullets.filter((x) =>
    hasActionVerb(x.text),
  ).length;
  const problem =
    /\b(problem|objective|goal|aim|explore|analyse|analyze|understand|identify|investigate|study|predict|forecast|detect)\b/i.test(
      txt,
    );
  const methodology = roleCfg.project.some((x) => termPresent(txt, x));
  const measurable =
    /\b\d+(?:\.\d+)?%|\b\d{3,}\+?\b|\b\d+(?:\.\d+)?x\b/i.test(txt);
  const insight =
    /\b(insight|identified|found|revealed|showed|indicated|reason|trend|increase|decrease|reduced|improved|impact|result|outcome|saved|accuracy|precision|recall|f1)\b/i.test(
      txt,
    );
  return {
    problem,
    methodology,
    measurable,
    insight,
    contribution,
    bullets: bullets.length,
  };
}
function meaningfulRewriteBullet(line, course) {
  const raw = cleanLine(line);
  if (!raw) return "";
  let rewritten = rewriteBullet(raw, course);
  // Improve weak "worked on/responsible for" language without inventing facts.
  rewritten = rewritten
    .replace(/\bworked on\b/i, "developed")
    .replace(/\bresponsible for\b/i, "handled")
    .replace(/\bhelped to\b/i, "supported");
  if (rewritten === raw || rewritten === raw + ".") return "";
  return rewritten;
}
function sectionActualText(lines) {
  return lines.map((x) => x.text).join(" ");
}
function looksLikeEntriPrimaryCertificate(raw, courseCfg) {
  const t = certNorm(raw);
  if (courseCfg.certs.some((c) => t.includes(certNorm(c)))) return true;
  const hasEntri = /\bentri\b/i.test(raw);
  const courseTokens = courseCfg.certs.flatMap((c) =>
    certNorm(c)
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 4 &&
          !["program", "advanced", "powered", "driven", "with"].includes(
            w,
          ),
      ),
  );
  const overlap = courseTokens.filter((w) => t.includes(w)).length;
  return hasEntri && overlap >= 2;
}
function thirdPartyCredentialPresent(raw) {
  return /\b(nsdc|microsoft|google|ibm|coursera|udemy|aws|amazon web services|cisco|comptia|oracle|meta|adobe|tableau)\b/i.test(
    raw,
  );
}
function standardHeadingSuggestion(key, hit) {
  if (!hit) return null;
  if (isStandardHeading(key, hit.actual)) return null;
  return `This section is present. For clearer ATS parsing and recruiter scanning, rename the current heading '${hit.actual}' to '${recommendedHeading(key)}'.`;
}
function scoreFromDeductions(base, deductions) {
  return Math.max(0, Math.min(5, base - deductions));
}
function roleHeadline(course, role) {
  return role;
}


/* ------------------------------------------------------------------ *
 * Project copy-ready description
 *
 * The copy-ready text must be an IMPROVED version of the project, never
 * a repeat of what the resume already says. It is built from facts that
 * are in the resume (title, tools, the learner's own bullets) and adds only
 * what is missing - as clearly marked [bracketed] prompts, never invented
 * numbers. If the project already has everything, no card is produced.
 * ------------------------------------------------------------------ */
const GERUND_TO_PAST = {
  building: "Built",
  creating: "Created",
  developing: "Developed",
  designing: "Designed",
  analyzing: "Analyzed",
  analysing: "Analyzed",
  implementing: "Implemented",
  testing: "Tested",
  cleaning: "Cleaned",
  training: "Trained",
};
const WEAK_OPENERS = [
  [/^worked on (\w+ing)\s+/i, (m) => (GERUND_TO_PAST[m[1].toLowerCase()] || "Developed") + " "],
  [/^worked on\s+/i, () => "Developed "],
  [/^responsible for (\w+ing)\s+/i, (m) => (GERUND_TO_PAST[m[1].toLowerCase()] || "Handled") + " "],
  [/^responsible for\s+/i, () => "Handled "],
  [/^helped (?:to )?/i, () => "Supported ", true],
  [/^(?:involved in|participated in)\s+/i, () => "Contributed to "],
  [/^(?:did|made)\s+/i, () => "Built "],
  [/^used\s+/i, () => "Applied "],
];
const BASE_TO_GERUND = {
  clean: "cleaning", find: "finding", build: "building", create: "creating", analyze: "analyzing",
  analyse: "analyzing", develop: "developing", design: "designing", test: "testing", prepare: "preparing",
  visualize: "visualizing", identify: "identifying", generate: "generating", extract: "extracting",
  transform: "transforming", evaluate: "evaluating", train: "training", perform: "performing",
  write: "writing", implement: "implementing", document: "documenting", deploy: "deploying",
};
function toGerunds(t) {
  // "clean the data and find trends" -> "cleaning the data and finding trends"
  return t.replace(/(^|\band\s+)(\w+)\b/gi, (m, pre, w) =>
    BASE_TO_GERUND[w.toLowerCase()] ? pre + BASE_TO_GERUND[w.toLowerCase()] : m,
  );
}
function polishProjectBullet(line, course) {
  let t = cleanLine(line).replace(/\s+/g, " ").replace(/[.;]+$/, "").trim();
  if (!t) return "";
  let changed = false;
  for (const [re, fn, gerund] of WEAK_OPENERS) {
    const m = t.match(re);
    if (m) {
      const rest = t.slice(m[0].length);
      t = fn(m) + (gerund ? toGerunds(rest) : rest);
      changed = true;
      break;
    }
  }
  if (!changed && !hasActionVerb(t)) t = rewriteBullet(t, course).replace(/\.$/, "");
  t = t.replace(/\b(various|etc\.?|and so on)\b/gi, "").replace(/\s{2,}/g, " ").replace(/[,\s]+$/, "");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t + ".";
}
function buildProjectRewrite(block, course, roleCfg) {
  const title = block.title || "Project";
  const blockText = block.lines.map((x) => x.text).join(" ");
  const tools = evidenceToolPool(course)
    .filter((x) => !["github", "git"].includes(x) && termPresent(blockText, x))
    .map((x) => ({ key: x, label: prettySkill(x) }));
  const q = projectQuality(block, roleCfg);

  // The learner's own description lines (title line excluded).
  const body = block.lines.filter(
    (x, i) =>
      i > 0 &&
      !x.text.includes("|") &&
      !/^(live demo|demo|github|source code|live link|live)\b/i.test(cleanLine(x.text)) &&
      !/^(tools?|technologies?|tech stack|duration|date|github|live|link)\b/i.test(cleanLine(x.text)) &&
      cleanLine(x.text).split(/\s+/).length >= 4,
  );
  const original = new Set(body.map((x) => normalizedMatchText(cleanLine(x.text))));

  const bullets = [];
  const gaps = [];
  if (!q.problem)
    gaps.push("[Objective: one line on the problem this project analyses, solves, predicts or improves.]");
  body.slice(0, 3).forEach((x) => {
    const b = polishProjectBullet(x.text, course);
    if (b && !original.has(normalizedMatchText(b)) && !original.has(normalizedMatchText(b.replace(/\.$/, ""))))
      bullets.push(b);
  });
  if (!body.length && tools.length)
    bullets.push(`Developed ${title} using ${tools.slice(0, 4).map((x) => x.label).join(", ")}.`);
  if (!q.measurable)
    gaps.push("[Result: add a verified number, e.g. records analysed, accuracy %, time saved, users or transactions.]");
  if (!q.insight)
    gaps.push("[Impact: one line on what the analysis or build revealed or enabled.]");

  const lines = [...gaps.filter((g) => g.startsWith("[Objective")), ...bullets, ...gaps.filter((g) => !g.startsWith("[Objective"))];
  // Nothing to improve -> no card. We never show text that matches the resume.
  if (!bullets.length && !gaps.length) return null;
  const text = [tools.length ? `${title} | ${tools.slice(0, 5).map((x) => x.label).join(", ")}` : title, ...lines.map((l) => `• ${l}`)].join("\n");
  return {
    label: `Copy-ready project description — ${title}`,
    note: gaps.length ? "Replace every [bracketed] prompt with a real detail before using. Nothing in brackets has been assumed." : "",
    text,
  };
}

export { buildProjectRewrite, evidenceToolPool, sectionSpan, certNorm, validIssuer, githubRoot, githubRepoUrls, invalidGithubProjectUrls, liveUrls, portfolioUrls, looksLikeProjectTitle, splitProjectBlocks, estimateProjects, projectDateValue, projectQuality, meaningfulRewriteBullet, sectionActualText, looksLikeEntriPrimaryCertificate, thirdPartyCredentialPresent, standardHeadingSuggestion, scoreFromDeductions, roleHeadline };
