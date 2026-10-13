import { parseResume } from "./pdf/parser.js";
import { structure, mergeLines, sectionLines } from "./analysis/structure.js";
import { evaluate } from "./evaluation/evaluate.js";
import { enrichProjectQuantification, recomputeResultScore } from "./github/repoEvidence.js";

/**
 * Full pipeline: PDF -> parsed pages -> section structure -> review -> optional
 * GitHub evidence check. Pure logic; the UI only passes callbacks.
 */
export async function runEvaluation(file, opts, { onStatus = () => {}, onPage = () => {} } = {}) {
  const parsed = await parseResume(file, { onStatus, onPage });
  onStatus("Building section-by-section evaluation report...");

  let st;
  try {
    st = structure(parsed);
  } catch (err) {
    console.warn("Structure detection fallback used:", err);
    st = { pageLines: {}, hits: [] };
    parsed.pages.forEach((p) => {
      st.pageLines[p.page] = mergeLines(p);
    });
  }

  let result = evaluate(parsed, st, opts);
  onStatus("Checking linked project repositories for verified quantification evidence...");
  try {
    result = await enrichProjectQuantification(parsed, st, result);
    result = recomputeResultScore(result);
  } catch (err) {
    console.warn("Linked project evidence check skipped:", err);
  }
  // Keep what the Job Description Match tab needs.
  const joinLines = (k) => sectionLines(parsed, st, k).map((l) => l.text).join(" ");
  return {
    ...result,
    runId: Date.now(),
    resume: {
      text: parsed.text,
      sections: {
        summary: joinLines("summary"),
        skills: joinLines("skills"),
        projects: joinLines("projects"),
        experience: joinLines("experience"),
      },
    },
  };
}
