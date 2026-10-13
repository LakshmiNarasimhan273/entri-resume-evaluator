import { norm } from '../../utils/helpers.js';
import { HEADINGS, STANDARD } from '../../config/resumeConfig.js';

function addReview(
  reviews,
  key,
  title,
  score,
  good,
  suggest,
  rewrite = [],
  na = false,
  evidence = "",
) {
  reviews.push({
    key,
    title,
    score,
    good,
    suggest,
    rewrite,
    na,
    evidence,
  });
}
function cleanLine(s) {
  return (s || "").replace(/^[-•▪◦*]\s*/, "").trim();
}
function cap(s) {
  s = (s || "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function hasActionVerb(s) {
  const t = norm(cleanLine(s));
  const verbs = [
    "managed",
    "assisted",
    "created",
    "analysed",
    "analyzed",
    "coordinated",
    "prepared",
    "developed",
    "supported",
    "maintained",
    "improved",
    "presented",
    "cleaned",
    "built",
    "designed",
    "implemented",
    "tested",
    "deployed",
    "automated",
    "optimized",
    "optimised",
    "visualized",
    "visualised",
    "modelled",
    "modeled",
    "predicted",
    "trained",
    "evaluated",
    "performed",
    "generated",
    "identified",
    "extracted",
    "transformed",
    "conducted",
    "configured",
    "integrated",
  ];
  return verbs.some((v) => t === v || t.startsWith(v + " "));
}
function rewriteBullet(line, course) {
  const raw = cleanLine(line);
  if (!raw) return "";
  if (hasActionVerb(raw)) return raw.endsWith(".") ? raw : raw + ".";
  let verb = "Developed";
  const t = norm(raw);
  if (course === "Data Analytics") {
    if (/dashboard|power bi|tableau|report/.test(t)) verb = "Created";
    else if (/sql|data|dataset|trend|analysis/.test(t)) verb = "Analyzed";
    else verb = "Prepared";
  } else if (course === "Data Science") {
    if (/model|classification|regression|prediction/.test(t))
      verb = "Built";
    else if (/data|dataset|eda|clean/.test(t)) verb = "Analyzed";
    else verb = "Developed";
  } else if (course === "UI UX") {
    if (/research|persona|user/.test(t)) verb = "Conducted";
    else verb = "Designed";
  } else if (course === "Cyber Security") {
    if (/scan|vulnerability|security|network/.test(t)) verb = "Conducted";
    else verb = "Analyzed";
  } else {
    if (/test|testing/.test(t)) verb = "Tested";
    else if (/api|database|backend|application|app|website|web/.test(t))
      verb = "Developed";
    else verb = "Implemented";
  }
  const lower = raw.charAt(0).toLowerCase() + raw.slice(1);
  return `${verb} ${lower}${/[.!?]$/.test(lower) ? "" : "."}`;
}
function firstWords(txt, n = 9) {
  return (txt || "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}
function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}
function includesAny(txt, arr) {
  return arr.some((x) => txt.includes(x));
}
function detectEmail(t) {
  const raw = (t || "")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, " ");
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw);
}
function detectPhone(t) {
  const raw = (t || "").replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  const patterns = [
    /(?:\+?\s*91[\s\-.:]*)?([6-9](?:[\s\-.:]*\d){9})\b/,
    /\b([6-9]\d{4}[\s\-]\d{5})\b/,
    /\b([6-9]\d{2}[\s\-]\d{3}[\s\-]\d{4})\b/,
  ];
  if (patterns.some((r) => r.test(raw))) return true;
  const candidates =
    raw.match(/(?:\+?\s*91[\s\-.:]*)?[6-9][\d\s\-.:]{8,18}\d/g) || [];
  return candidates.some((c) => {
    let d = c.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    return /^[6-9]\d{9}$/.test(d);
  });
}
function detectCityState(t) {
  return /\b[A-Za-z][A-Za-z .'-]{1,24},\s*[A-Za-z][A-Za-z .'-]{1,24}\b/.test(
    t || "",
  );
}
function urlHas(urls, pattern) {
  return (urls || []).some((u) => pattern.test(u));
}
function normalizeHeading(t) {
  return norm(t)
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function headingType(text) {
  const raw = (text || "").trim();
  const t = normalizeHeading(raw);
  if (!t) return null;

  // A section heading should be short and should not look like a sentence/contact line.
  const words = t.split(" ").filter(Boolean);
  if (words.length > 8) return null;
  // "Technical Skills: Python, SQL" is a labelled content line, not a section heading.
  if (/:\s*\S/.test(raw)) return null;
  if (/[.!?]$/.test(raw) && words.length > 3) return null;
  if (/@|https?:\/\/|www\.|\+?\d[\d\s\-]{7,}/i.test(raw)) return null;

  // Exact aliases are safest.
  for (const [k, alts] of Object.entries(HEADINGS)) {
    if (alts.includes(t)) return { key: k, actual: raw, match: "alias" };
  }

  // Conservative keyword fallbacks for decorated headings.
  if (
    /\b(skill|skills|technolog|tech stack|expertise|competenc|proficienc)\b/i.test(
      t,
    )
  )
    return { key: "skills", actual: raw, match: "keyword" };

  if (/\b(project|projects|case study|case studies|labs?)\b/i.test(t))
    return { key: "projects", actual: raw, match: "keyword" };

  if (
    /\b(education|educational|academic|qualification|academics)\b/i.test(
      t,
    )
  )
    return { key: "education", actual: raw, match: "keyword" };

  if (
    /\b(experience|employment|internship|work history|career history)\b/i.test(
      t,
    )
  )
    return { key: "experience", actual: raw, match: "keyword" };

  if (/\b(summary|profile|objective|about me)\b/i.test(t))
    return { key: "summary", actual: raw, match: "keyword" };

  if (
    /\b(certification|certifications|certificate|credentials|training|courses)\b/i.test(
      t,
    )
  )
    return { key: "certifications", actual: raw, match: "keyword" };

  if (/\b(achievement|achievements|awards|honours|honors)\b/i.test(t))
    return { key: "achievements", actual: raw, match: "keyword" };

  if (/\b(language|languages)\b/i.test(t))
    return { key: "languages", actual: raw, match: "keyword" };

  return null;
}
function isStandardHeading(key, actual) {
  const t = normalizeHeading(actual);
  return (STANDARD[key] || []).some((x) => normalizeHeading(x) === t);
}
function recommendedHeading(key) {
  if (key === "skills") return "Technical Skills";
  if (key === "projects") return "Projects";
  if (key === "summary") return "Professional Summary";
  if (key === "experience") return "Experience";
  if (key === "education") return "Education";
  if (key === "certifications") return "Certifications";
  if (key === "achievements") return "Achievements";
  if (key === "languages") return "Languages";
  return cap(key);
}


// Words that legitimately take a hyphen ("Full-Stack"), so they are never joined.
const HYPHEN_PREFIXES = new Set(["full","front","back","end","high","low","real","self","user","data","open","well","cross","multi","non","pre","post","co","ai","ml","ui","ux","up","in","on","off","hands","role","long","short","part","third","first","state","cloud","e","x","re","by","per","one","two","top","semi"]);
/**
 * Clean a snippet of resume text for the "Detected from resume" line:
 * joins words split by a line-break hyphen ("Pro- ficient" -> "Proficient") and shortens at a
 * word boundary instead of cutting mid-word.
 */
function tidyEvidence(text, max = 220) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  t = t.replace(/\b([A-Za-z]{2,4})-\s+([a-z]{3,})\b/g, (m, a, b) =>
    HYPHEN_PREFIXES.has(a.toLowerCase()) ? m : a + b,
  );
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;|•–-]+$/, "") + " …";
}

export { tidyEvidence, addReview, cleanLine, cap, hasActionVerb, rewriteBullet, firstWords, uniq, includesAny, detectEmail, detectPhone, detectCityState, urlHas, normalizeHeading, headingType, isStandardHeading, recommendedHeading };
