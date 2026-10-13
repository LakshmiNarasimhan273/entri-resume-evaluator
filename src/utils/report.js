// Plain-text export of a finished evaluation (used by "Copy report" / "Download report").
export function buildReportText(result, learner) {
  const out = [];
  out.push(`Resume Evaluation — ${learner || "Learner"} • ${result.role}`);
  out.push(`Course: ${result.course} | Level: ${result.level} | Score: ${result.total}/100`);
  out.push("");
  for (const r of result.reviews) {
    out.push(r.title + (r.na ? " (not required)" : `  [${r.score.toFixed(1)}/5]`));
    if (r.good?.length) {
      out.push("  Written well:");
      r.good.forEach((x) => out.push(`   + ${x}`));
    }
    if (r.suggest?.length) {
      out.push("  Suggestions:");
      r.suggest.forEach((x) => out.push(`   - ${x}`));
    }
    if (r.rewrite?.length) {
      out.push("  Copy-ready:");
      r.rewrite.forEach((x) => {
        out.push(`   ${x.label}`);
        x.text.split("\n").forEach((l) => out.push(`     ${l}`));
      });
    }
    out.push("");
  }
  return out.join("\n");
}

export function downloadTextFile(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
