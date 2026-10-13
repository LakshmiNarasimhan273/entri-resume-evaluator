import Stars from "./Stars.jsx";
import CopyButton from "./CopyButton.jsx";

function Lines({ items, empty }) {
  if (!items?.length) return <div className="na">{empty}</div>;
  return items.map((x, i) => (
    <div className="line" key={i}>{x}</div>
  ));
}

export default function ReviewCard({ review: r, role, id }) {
  return (
    <section className="card review-card" id={id}>
      <div className="review-head">
        <div>
          <h3>{r.title}</h3>
          <div className="order">Reviewed in resume order • role alignment: {role}</div>
        </div>
        <Stars score={r.score} na={r.na} />
      </div>
      <div className="review-grid">
        <div className="box goodbox">
          <h4>What is written well</h4>
          <Lines items={r.good} empty="No strong point detected in this section yet." />
        </div>
        <div className="box suggestbox">
          <h4>Suggestions to improve</h4>
          <Lines items={r.suggest} empty="No specific change required." />
        </div>
        {r.rewrite?.length > 0 && (
          <div className="box rewritebox rewrite-wrap">
            <h4>Copy-ready rewrite</h4>
            {r.rewrite.map((x, i) => (
              <div className="rewrite" key={i}>
                <div className="rewrite-top">
                  <span className="rewrite-label">{x.label}</span>
                  <CopyButton text={x.text} />
                </div>
                {x.note && <div className="rewrite-note">{x.note}</div>}
                <div className="rewrite-text">{x.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {r.linkEvidence?.length > 0 && (
        <div className="link-evidence">
          <strong>Verified from project link</strong>
          <span className="verified">Evidence-backed</span>
          {r.linkEvidence.map((x, i) => (
            <div style={{ marginTop: 6 }} key={i}>
              <b>{x.project}</b> • {x.repo}
              {x.items.map((it, j) => (
                <div key={j}>{it}</div>
              ))}
            </div>
          ))}
        </div>
      )}
      {r.evidence && <div className="evidence">Detected from resume: {r.evidence}</div>}
    </section>
  );
}
