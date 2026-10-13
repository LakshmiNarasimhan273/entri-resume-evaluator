import { COURSE_CONFIG, SECTION_WEIGHTS } from '../../config/resumeConfig.js';
import { cap, uniq, normalizeHeading } from '../analysis/text.js';
import { firstHit, sectionLines, normalizedMatchText, termPresent, prettySkill } from '../analysis/structure.js';
import { evidenceToolPool, githubRoot, splitProjectBlocks, projectQuality } from '../analysis/sections.js';

function timeoutFetch(url, options = {}, ms = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(
    () => clearTimeout(timer),
  );
}
function githubRepoParts(url) {
  const root = githubRoot(url);
  if (!root) return null;
  try {
    const u = new URL(root);
    const seg = u.pathname.split("/").filter(Boolean);
    return seg.length >= 2 ? { owner: seg[0], repo: seg[1], root } : null;
  } catch (e) {
    return null;
  }
}
function decodeBase64Utf8(b64) {
  try {
    const bin = atob((b64 || "").replace(/\n/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    return "";
  }
}
function extractNumericClaims(text) {
  const src = (text || "").replace(/\r/g, " ").replace(/\n+/g, " ");
  const patterns = [
    /\b\d{1,3}(?:,\d{3})+\+?\s+(?:rows|records|entries|transactions|samples|patients|users|products|orders|readmissions|observations)\b/gi,
    /\b\d+\+?\s+(?:rows|records|entries|transactions|samples|patients|users|products|orders|readmissions|observations)\b/gi,
    /\b(?:accuracy|precision|recall|f1(?:-score)?|auc|r2|r²|rmse|mae|mse)\s*(?:of|:|=)?\s*\d+(?:\.\d+)?%?\b/gi,
    /\b\d+(?:\.\d+)?%\s+(?:accuracy|precision|recall|improvement|increase|decrease|reduction|growth|drop|change)\b/gi,
    /\b(?:reduced|improved|increased|decreased|cut|saved)\s+[^.]{0,45}?\b\d+(?:\.\d+)?%\b/gi,
  ];
  const claims = [];
  for (const r of patterns) {
    const m = src.match(r) || [];
    claims.push(...m.map((x) => x.trim()));
  }
  return uniq(claims).slice(0, 8);
}
function countDelimitedRows(raw, delimiter = ",") {
  const lines = (raw || "").split(/\r?\n/).filter((x) => x.trim().length);
  if (lines.length < 2) return null;
  // Treat first row as header when it contains non-numeric labels.
  return Math.max(0, lines.length - 1);
}
function countJsonRecords(raw) {
  try {
    const x = JSON.parse(raw);
    if (Array.isArray(x)) return x.length;
    if (x && Array.isArray(x.data)) return x.data.length;
    if (x && Array.isArray(x.records)) return x.records.length;
    return null;
  } catch (e) {
    return null;
  }
}
async function fetchRepoEvidence(repoUrl) {
  const parts = githubRepoParts(repoUrl);
  if (!parts)
    return {
      ok: false,
      repoUrl,
      reason: "Invalid GitHub repository URL",
    };
  const { owner, repo, root } = parts;
  const headers = { Accept: "application/vnd.github+json" };

  try {
    const metaRes = await timeoutFetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );
    if (!metaRes.ok)
      return {
        ok: false,
        repoUrl: root,
        reason: `GitHub returned ${metaRes.status}`,
      };
    const meta = await metaRes.json();
    const branch = meta.default_branch || "main";

    let readme = "";
    try {
      const rr = await timeoutFetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        { headers },
      );
      if (rr.ok) {
        const rj = await rr.json();
        readme = decodeBase64Utf8(rj.content || "");
      }
    } catch (e) {}

    let tree = [];
    try {
      const tr = await timeoutFetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers },
      );
      if (tr.ok) {
        const tj = await tr.json();
        tree = (tj.tree || []).filter((x) => x.type === "blob");
      }
    } catch (e) {}

    const dataFiles = tree
      .filter(
        (x) =>
          /\.(csv|tsv|json)$/i.test(x.path || "") &&
          (x.size || 0) > 0 &&
          (x.size || 0) <= 1200000,
      )
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 4);

    const datasets = [];
    for (const f of dataFiles) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${f.path.split("/").map(encodeURIComponent).join("/")}`;
        const res = await timeoutFetch(rawUrl, {}, 6500);
        if (!res.ok) continue;
        const raw = await res.text();
        let count = null;
        if (/\.csv$/i.test(f.path)) count = countDelimitedRows(raw, ",");
        else if (/\.tsv$/i.test(f.path))
          count = countDelimitedRows(raw, "\t");
        else if (/\.json$/i.test(f.path)) count = countJsonRecords(raw);
        if (Number.isFinite(count) && count > 0)
          datasets.push({ path: f.path, count });
      } catch (e) {}
    }

    return {
      ok: true,
      repoUrl: root,
      owner,
      repo,
      description: meta.description || "",
      readme,
      numericClaims: extractNumericClaims(
        `${meta.description || ""} ${readme}`,
      ),
      datasets,
      fileCount: tree.length,
    };
  } catch (e) {
    return {
      ok: false,
      repoUrl: root,
      reason: e?.message || "Repository could not be read",
    };
  }
}
function titleTokens(s) {
  return normalizeHeading(s)
    .split(" ")
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          "project",
          "dashboard",
          "analysis",
          "system",
          "using",
          "with",
          "and",
          "the",
        ].includes(w),
    );
}
function matchRepoToBlock(block, evidenceList, index) {
  if (!evidenceList.length) return null;
  const bt = titleTokens(block.title);
  let best = null,
    bestScore = -1;
  evidenceList.forEach((ev) => {
    const rt = titleTokens(ev.repo || "");
    const score = bt.filter((x) =>
      rt.some((y) => y.includes(x) || x.includes(y)),
    ).length;
    if (score > bestScore) {
      bestScore = score;
      best = ev;
    }
  });
  if (bestScore > 0) return best;
  return evidenceList[index] || null;
}
function buildVerifiedQuantificationSuggestion(block, ev) {
  const items = [];
  if (ev.datasets?.length) {
    const d = ev.datasets[0];
    items.push(
      `Repository data file '${d.path}' contains ${d.count.toLocaleString()} data rows (header excluded).`,
    );
  }
  if (ev.numericClaims?.length) {
    items.push(
      `Repository/README states: ${ev.numericClaims.slice(0, 3).join("; ")}.`,
    );
  }
  return items;
}
function buildSafeQuantifiedRewrite(block, ev, course) {
  const title = block.title || "project";
  const tools = evidenceToolPool(course)
    .filter((t) =>
      termPresent(block.lines.map((x) => x.text).join(" "), t),
    )
    .map(prettySkill);
  const d = ev.datasets?.[0];
  const claim = ev.numericClaims?.[0];

  if (d) {
    const toolText = tools.length
      ? ` using ${tools.slice(0, 4).join(", ")}`
      : "";
    return `Analyzed ${d.count.toLocaleString()} records from '${d.path}'${toolText} as part of ${title}; add the verified insight or business outcome from the project dashboard/analysis if it is not already stated.`;
  }
  if (claim) {
    const toolText = tools.length
      ? ` using ${tools.slice(0, 4).join(", ")}`
      : "";
    return `Completed ${title}${toolText}; repository evidence confirms ${claim}. Keep this metric only if it reflects the learner's own project result.`;
  }
  return "";
}
async function enrichProjectQuantification(parsed, st, result) {
  const hProjects = firstHit(st, "projects");
  if (!hProjects) return result;

  const projectLines = sectionLines(parsed, st, "projects");
  const blocks = splitProjectBlocks(projectLines);
  if (!blocks.length) return result;

  const repoRoots = uniq(
    (parsed.urls || []).map(githubRoot).filter(Boolean),
  ).slice(0, 4);
  if (!repoRoots.length) return result;

  const projectReview = result.reviews.find((r) => r.key === "projects");
  if (!projectReview) return result;

  const evidenceList = [];
  for (const root of repoRoots) {
    const ev = await fetchRepoEvidence(root);
    if (ev.ok) evidenceList.push(ev);
  }
  if (!evidenceList.length) return result;

  projectReview.good = projectReview.good || [];
  projectReview.suggest = projectReview.suggest || [];
  projectReview.rewrite = projectReview.rewrite || [];
  projectReview.linkEvidence = [];

  blocks.forEach((block, index) => {
    const ev = matchRepoToBlock(block, evidenceList, index);
    if (!ev) return;

    const verified = buildVerifiedQuantificationSuggestion(block, ev);
    if (verified.length) {
      projectReview.good.push(
        `Verified from ${ev.repoUrl}: ${verified.join(" ")}`,
      );
      projectReview.linkEvidence.push({
        project: block.title,
        repo: ev.repoUrl,
        items: verified,
      });
    }

    const alreadyQuantified = projectQuality(
      block,
      COURSE_CONFIG[result.course].roles[result.role],
    ).measurable;
    if (
      !alreadyQuantified &&
      (ev.datasets?.length || ev.numericClaims?.length)
    ) {
      projectReview.suggest.push(
        `For '${block.title}', use the verified repository evidence to quantify the project instead of adding an estimated number.`,
      );
      const rw = buildSafeQuantifiedRewrite(block, ev, result.course);
      if (rw)
        projectReview.rewrite.push({
          label: `Verified quantification suggestion — ${block.title}`,
          text: rw,
        });
    } else if (!alreadyQuantified) {
      projectReview.suggest.push(
        `No reliable numeric evidence was found in the linked public repository for '${block.title}'. Do not invent a number; quantify only after checking the dataset, model output, dashboard or project report.`,
      );
    }
  });

  // Avoid duplicate rewrite cards.
  const seen = new Set();
  projectReview.rewrite = projectReview.rewrite
    .filter((x) => {
      const k = normalizedMatchText(x.text);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 4);

  return result;
}
function recomputeResultScore(result) {
  const reviews = result.reviews;
  for (const r of reviews) {
    if (r.na) continue;
    const n = (r.suggest || []).length;
    if (n > 0) {
      const cap = Math.max(2.5, 4.6 - (n - 1) * 0.3);
      r.score = Math.min(r.score, cap);
    }
    if (n > 0 && r.score >= 5) r.score = 4.6;
    r.score = Math.round(r.score * 10) / 10;
  }

  let earned = 0,
    available = 0;
  for (const r of reviews) {
    const w = SECTION_WEIGHTS[r.key] || 0;
    if (r.na) continue;
    available += w;
    earned += (r.score / 5) * w;
  }
  let total = available ? Math.round((earned / available) * 100) : 0;
  const issueSections = reviews.filter(
    (r) => !r.na && (r.suggest || []).length > 0,
  );
  const suggestionCount = issueSections.reduce(
    (n, r) => n + r.suggest.length,
    0,
  );
  total = Math.max(
    0,
    total - Math.min(12, Math.max(0, suggestionCount - 2) * 0.8),
  );

  const skillReview = reviews.find((r) => r.key === "skills");
  const projectReview = reviews.find((r) => r.key === "projects");
  if (issueSections.length >= 4) total = Math.min(total, 84);
  if (skillReview && !skillReview.na && skillReview.score < 4)
    total = Math.min(total, 84);
  if (projectReview && !projectReview.na && projectReview.score < 4)
    total = Math.min(total, 84);

  result.total = Math.round(total);
  result.ready =
    result.total > 85 &&
    issueSections.length <= 2 &&
    (!projectReview || projectReview.na || projectReview.score >= 4.2) &&
    (!skillReview || skillReview.na || skillReview.score >= 4.2);
  return result;
}


export { timeoutFetch, githubRepoParts, decodeBase64Utf8, extractNumericClaims, countDelimitedRows, countJsonRecords, fetchRepoEvidence, titleTokens, matchRepoToBlock, buildVerifiedQuantificationSuggestion, buildSafeQuantifiedRewrite, enrichProjectQuantification, recomputeResultScore };
