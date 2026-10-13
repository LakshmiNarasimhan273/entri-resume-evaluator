import { norm } from '../../utils/helpers.js';
import { uniq, normalizeHeading, headingType } from './text.js';

function mergeOneSource(items, height) {
  const src = (items || [])
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x),
    lines = [];
  for (const i of src) {
    const yNorm = (i.y || 0) / (height || 1);
    const existing = lines.find(
      (l) => Math.abs(l.yNorm - yNorm) <= 0.006,
    );
    if (existing) {
      existing.items.push(i);
      existing.text += " " + i.text;
    } else lines.push({ y: i.y, yNorm, text: i.text, items: [i] });
  }
  return lines.sort((a, b) => a.yNorm - b.yNorm);
}
function mergeLines(page) {
  const pdf = mergeOneSource(page.pdfItems || [], page.baseHeight || 1);
  const ocr = mergeOneSource(page.ocrLines || [], page.cameraHeight || 1);
  const out = [...pdf];

  for (const ol of ocr) {
    const duplicate = out.some((pl) => {
      const a = norm(pl.text),
        b = norm(ol.text);
      return (
        Math.abs(pl.yNorm - ol.yNorm) < 0.018 &&
        (a === b || a.includes(b) || b.includes(a))
      );
    });
    if (!duplicate) out.push(ol);
  }
  return out.sort((a, b) => a.yNorm - b.yNorm);
}
function structure(parsed) {
  const pageLines = {},
    hits = [];
  parsed.pages.forEach((p) => {
    const lines = mergeLines(p);
    pageLines[p.page] = lines;

    const bodyHeights = (p.pdfItems || [])
      .map((x) => x.h)
      .filter((h) => h > 0)
      .sort((a, b) => a - b);
    const medianH = bodyHeights.length
      ? bodyHeights[Math.floor(bodyHeights.length / 2)]
      : 0;

    // Highest-confidence pass: exact standalone items such as "Skills", "Projects", "Education".
    for (const item of p.pdfItems || []) {
      const h = headingType(item.text);
      if (
        h &&
        h.match === "alias" &&
        normalizeHeading(item.text).split(" ").length <= 4
      ) {
        hits.push({
          ...h,
          page: p.page,
          y: (item.y || 0) / (p.baseHeight || 1),
          fonts: item.font ? [item.font] : [],
          avgH: item.h || 0,
          confidence: 4,
        });
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let h = headingType(l.text);
      if (!h && i < lines.length - 1) {
        const n = lines[i + 1];
        if (Math.abs(n.yNorm - l.yNorm) <= 0.032) {
          const hh = headingType(`${l.text} ${n.text}`);
          if (hh) h = { ...hh, actual: `${l.text} ${n.text}` };
        }
      }
      if (h) {
        const fonts = uniq(l.items.map((x) => x.font).filter(Boolean));
        const avgH = l.items.length
          ? l.items.reduce((s, x) => s + (x.h || 0), 0) / l.items.length
          : 0;
        const wordCount = normalizeHeading(h.actual)
          .split(" ")
          .filter(Boolean).length;
        const exactAlias = h.match === "alias";
        const visualHeading =
          medianH && avgH ? avgH >= medianH * 0.98 : false;
        const shortClean =
          wordCount <= 5 && !/[.!?]$/.test(h.actual.trim());
        if (
          exactAlias ||
          (shortClean && visualHeading) ||
          (shortClean && /^[A-Z0-9/& -]+$/.test(h.actual.trim()))
        ) {
          hits.push({
            ...h,
            page: p.page,
            y: l.yNorm,
            fonts,
            avgH,
            confidence: exactAlias ? 3 : 1,
          });
        }
      }
    }
  });

  const grouped = [];
  hits
    .sort(
      (a, b) =>
        a.page - b.page || a.y - b.y || b.confidence - a.confidence,
    )
    .forEach((h) => {
      const same = grouped.find(
        (d) =>
          d.key === h.key &&
          d.page === h.page &&
          Math.abs(d.y - h.y) < 0.028,
      );
      if (!same) grouped.push(h);
      else if ((h.confidence || 0) > (same.confidence || 0))
        Object.assign(same, h);
    });
  const ordered = grouped.sort((a, b) => a.page - b.page || a.y - b.y);
  markSkillSubHeadings(ordered);
  return { pageLines, hits: ordered };
}
/**
 * "Key Skills" with "Technical Skills" / "Soft Skills" nested underneath is an
 * accepted layout (it saves vertical space). Any skills-type heading that
 * directly follows another skills heading - with no other section in between -
 * is a sub-heading of that block, not a new section.
 */
function markSkillSubHeadings(hits) {
  let inSkills = false;
  for (const h of hits) {
    if (h.key === "skills") {
      if (inSkills) h.sub = true;
      else inSkills = true;
    } else if ((h.confidence || 0) >= 2) {
      inSkills = false; // a real, different section starts here
    }
  }
  return hits;
}
function firstHit(st, key) {
  const c = st.hits.filter((x) => x.key === key);
  if (!c.length) return null;
  const max = Math.max(...c.map((x) => x.confidence || 0));
  return c
    .filter((x) => (x.confidence || 0) === max)
    .sort((a, b) => a.page - b.page || a.y - b.y)[0];
}
function sectionLines(parsed, st, key) {
  const start = firstHit(st, key);
  if (!start) return [];
  const later = st.hits
    .filter(
      (x) =>
        !x.sub &&
        (x.page > start.page ||
          (x.page === start.page && x.y > start.y + 0.006)) &&
        (x.confidence || 0) >= 2,
    )
    .sort((a, b) => a.page - b.page || a.y - b.y);
  const next = later[0] || null,
    out = [];
  parsed.pages.forEach((p) => {
    if (p.page < start.page) return;
    if (next && p.page > next.page) return;
    (st.pageLines[p.page] || []).forEach((l) => {
      const y = l.yNorm;
      if (p.page === start.page && y <= start.y + 0.012) return;
      if (next && p.page === next.page && y >= next.y - 0.006) return;
      if (headingType(l.text)) return;
      out.push({ page: p.page, text: l.text, y });
    });
  });
  return out;
}
function headerText(parsed, st) {
  const p = parsed.pages[0];
  if (!p) return "";
  const first = st.hits.find((x) => x.page === 1);
  const cutoff = first ? Math.max(first.y, 0.18) : 0.32;
  const structured = (st.pageLines[1] || [])
    .filter((l) => l.yNorm < cutoff)
    .map((l) => l.text)
    .join(" ");
  return [
    structured,
    p.headerOCR || "",
    (p.pdfText || "").slice(0, 1400),
    (p.ocrText || "").slice(0, 1800),
  ].join(" ");
}
function sectionPos(st, key) {
  const h = firstHit(st, key);
  return h ? h.page * 10 + h.y : null;
}
function normalizedMatchText(text) {
  return norm(text)
    .replace(/\bmy\s+sql\b/g, "mysql")
    .replace(/\bpowerbi\b/g, "power bi")
    .replace(/\bscikit\s+learn\b/g, "scikit-learn")
    .replace(/\bnode\.?\s*js\b/g, "node")
    .replace(/\breact\.?\s*js\b/g, "react");
}
function termPresent(text, term) {
  const t = normalizedMatchText(text);
  const q = normalizedMatchText(term);
  if (!q) return false;
  if (q === "r")
    return /(^|[^a-z0-9])r(?:\s+programming)?([^a-z0-9]|$)/i.test(t);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(t);
}
function termsFound(text, terms) {
  return terms.filter((x) => termPresent(text, x));
}
function topDetectedSkills(roleCfg, text) {
  const pool = uniq([
    ...roleCfg.must,
    ...roleCfg.concepts,
    ...roleCfg.alt.flat(),
  ]);
  return termsFound(text, pool).slice(0, 6);
}
function prettySkill(s) {
  const map = {
    "rest api": "REST API",
    api: "REST API",
    jwt: "JWT",
    oauth: "OAuth",
    typescript: "TypeScript",
    aws: "AWS",
    gcp: "GCP",
    nosql: "NoSQL",
    graphql: "GraphQL",
    postgresql: "PostgreSQL",
    tensorflow: "TensorFlow",
    pytorch: "PyTorch",
    fastapi: "FastAPI",
    nlp: "NLP",
    etl: "ETL",
    "ci/cd": "CI/CD",
    docker: "Docker",
    jest: "Jest",
    redux: "Redux",
    tailwind: "Tailwind CSS",
    sql: "SQL",
    mysql: "MySQL",
    "power bi": "Power BI",
    tableau: "Tableau",
    excel: "Excel",
    python: "Python",
    r: "R",
    pandas: "Pandas",
    numpy: "NumPy",
    "scikit-learn": "Scikit-learn",
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    react: "React",
    node: "Node.js",
    express: "Express.js",
    mongodb: "MongoDB",
    git: "Git",
    github: "GitHub",
    figma: "Figma",
    flutter: "Flutter",
    dart: "Dart",
    firebase: "Firebase",
    linux: "Linux",
    owasp: "OWASP",
    nmap: "Nmap",
    wireshark: "Wireshark",
    splunk: "Splunk",
    wazuh: "Wazuh",
    oop: "OOP",
    oops: "OOP",
    "api integration": "API Integration",
    "api testing": "API Testing",
    ec2: "EC2",
    s3: "S3",
    iam: "IAM",
    vpc: "VPC",
    dax: "DAX",
    eda: "EDA",
    kpi: "KPI",
    llm: "LLM",
    rag: "RAG",
    ui: "UI",
    dns: "DNS",
    siem: "SIEM",
    crud: "CRUD",
    jpa: "JPA",
    bloc: "BLoC",
    openai: "OpenAI",
    langchain: "LangChain",
    sqlite: "SQLite",
    "github actions": "GitHub Actions",
    "adobe xd": "Adobe XD",
    "route 53": "Route 53",
    cloudwatch: "CloudWatch",
    sklearn: "Scikit-learn",
  };
  return (
    map[normalizedMatchText(s)] ||
    String(s)
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bAi\b/g, "AI")
      .replace(/\bApi\b/g, "API")
      .replace(/\bUi\b/g, "UI")
  );
}

export { markSkillSubHeadings, mergeOneSource, mergeLines, structure, firstHit, sectionLines, headerText, sectionPos, normalizedMatchText, termPresent, termsFound, topDetectedSkills, prettySkill };
