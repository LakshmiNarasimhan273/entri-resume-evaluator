import CopyButton from "./CopyButton.jsx";

const FILTERS = [
  ["all", "All sections"],
  ["issues", "Needs work"],
  ["strong", "Strong"],
];

const tone = (r) => (r.na ? "na" : r.score >= 4 ? "good" : r.score >= 3 ? "warn" : "bad");

export default function ScoreOverview({ reviews, filter, onFilter, reportText, onDownload }) {
  return (
    <section className="card overview">
      <div className="overview-bars">
        {reviews.map((r) => (
          <a key={r.key} href={`#review-${r.key}`} className="ov-row">
            <span className="ov-name">{r.title.replace(/^\d+\.\s*/, "")}</span>
            <span className="ov-track">
              <span className={`ov-fill ${tone(r)}`} style={{ width: r.na ? "0%" : `${(r.score / 5) * 100}%` }} />
            </span>
            <span className="ov-val">{r.na ? "n/a" : r.score.toFixed(1)}</span>
          </a>
        ))}
      </div>
      <div className="toolbar">
        <div className="seg" role="tablist">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => onFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <CopyButton text={reportText} />
          <button className="btn copy" onClick={onDownload}>Download report</button>
        </div>
      </div>
    </section>
  );
}
