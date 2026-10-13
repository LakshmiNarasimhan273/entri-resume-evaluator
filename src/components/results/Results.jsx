import { useMemo, useState } from "react";
import ScoreHero from "./ScoreHero.jsx";
import ScoreOverview from "./ScoreOverview.jsx";
import ReviewCard from "./ReviewCard.jsx";
import { buildReportText, downloadTextFile } from "../../utils/report.js";

export default function Results({ result, learner }) {
  const [filter, setFilter] = useState("all");
  const reportText = useMemo(() => buildReportText(result, learner), [result, learner]);

  const shown = result.reviews.filter((r) => {
    if (filter === "issues") return !r.na && r.suggest?.length > 0;
    if (filter === "strong") return r.na || !r.suggest?.length;
    return true;
  });

  const onDownload = () =>
    downloadTextFile(
      `resume-evaluation-${(learner || "learner").trim().replace(/\s+/g, "-").toLowerCase()}.txt`,
      reportText,
    );

  return (
    <section id="results">
      <ScoreHero result={result} learner={learner} />
      <ScoreOverview
        reviews={result.reviews}
        filter={filter}
        onFilter={setFilter}
        reportText={reportText}
        onDownload={onDownload}
      />
      <div className="section-stack">
        {shown.map((r) => (
          <ReviewCard key={r.key} id={`review-${r.key}`} review={r} role={result.role} />
        ))}
        {!shown.length && <div className="card na">No sections match this filter.</div>}
      </div>
    </section>
  );
}
