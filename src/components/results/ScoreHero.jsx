export default function ScoreHero({ result, learner }) {
  const readyClass = result.ready ? "ready" : result.total >= 70 ? "minor" : "rework";
  const readyText = result.ready
    ? "Your resume is ready for manual mentor evaluation."
    : result.total >= 70
      ? "Good progress — improve the highlighted sections before manual mentor evaluation."
      : "Resume improvement required before manual mentor evaluation.";
  return (
    <section className="card hero">
      <div className="donut" style={{ "--score": result.total }}>
        <div className="num">
          <span>{result.total}</span>
          <small>/100</small>
        </div>
      </div>
      <div>
        <h2>{`${learner.trim() || "Learner"} • ${result.role}`}</h2>
        <p>{`Section-by-section review aligned to ${result.course} and the learner's preferred role: ${result.role}.`}</p>
        <span className={`readiness ${readyClass}`}>{readyText}</span>
      </div>
    </section>
  );
}
