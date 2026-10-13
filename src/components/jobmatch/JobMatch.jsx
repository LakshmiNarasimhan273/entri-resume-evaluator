import { useState } from "react";
import { matchJobDescription } from "../../services/jobMatch/jobMatch.js";
import CopyButton from "../results/CopyButton.jsx";

const WHERE = { skills: "Skills", projects: "Projects", experience: "Experience", summary: "Summary" };

export default function JobMatch({ result, jd, setJd }) {
  const [match, setMatch] = useState(null);

  const run = () => setMatch(matchJobDescription(jd, result.resume, { level: result.level }));

  return (
    <section id="jobmatch">
      <section className="card jd-input">
        <h3>Job Description Match</h3>
        <p className="jd-help">
          Paste the job description. The resume you just evaluated is compared against it. Only wording that is
          really in the resume counts as a match.
        </p>
        <textarea
          className="jd-text"
          rows={9}
          placeholder="Paste the full job description here..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
        <div className="jd-actions">
          <button className="btn primary" onClick={run} disabled={!jd.trim()}>
            Match with Resume
          </button>
          {match && (
            <button
              className="btn copy"
              onClick={() => {
                setJd("");
                setMatch(null);
              }}
            >
              Clear
            </button>
          )}
        </div>
        {match?.error && <div className="status">{match.error}</div>}
      </section>

      {match && !match.error && (
        <>
          <section className="card hero">
            <div className="donut" style={{ "--score": match.score }}>
              <div className="num">
                <span>{match.score}</span>
                <small>%</small>
              </div>
            </div>
            <div>
              <h2>{match.verdict}</h2>
              <p>
                {result.role} • {result.course} • {match.matched.length} of{" "}
                {match.matched.length + match.missing.length} requested skills found
              </p>
              <span className={`readiness ${match.tone === "good" ? "ready" : match.tone === "warn" ? "minor" : "rework"}`}>
                {match.tone === "good"
                  ? "Your resume lines up well with this job description."
                  : match.tone === "warn"
                    ? "Close — close the gaps below before applying."
                    : "Large gaps for this job description. Review the missing skills."}
              </span>
            </div>
          </section>

          <section className="card review-card">
            <div className="review-grid">
              <div className="box goodbox">
                <h4>Skills found in your resume</h4>
                {match.matched.length ? (
                  <div className="chips">
                    {match.matched.map((m) => (
                      <span className="chip ok" key={m.term} title={m.where.map((w) => WHERE[w]).join(", ") || "Resume text"}>
                        {m.label}
                        <small>{m.where.length ? m.where.map((w) => WHERE[w]).join(" · ") : "Resume"}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="na">None of the requested skills were found.</div>
                )}
                {match.keywords.matched.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 14 }}>Keywords found</h4>
                    <div className="chips">
                      {match.keywords.matched.map((k) => (
                        <span className="chip ok" key={k}>{k}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="box suggestbox">
                <h4>Missing from your resume</h4>
                {match.missing.length ? (
                  <div className="chips">
                    {match.missing.map((m) => (
                      <span className="chip miss" key={m.term}>{m.label}</span>
                    ))}
                  </div>
                ) : (
                  <div className="na">Every requested skill is covered.</div>
                )}
                {match.keywords.missing.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 14 }}>Keywords not found</h4>
                    <div className="chips">
                      {match.keywords.missing.map((k) => (
                        <span className="chip miss" key={k}>{k}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="box rewritebox rewrite-wrap">
                <h4>Suggestions to improve the match</h4>
                {match.suggestions.length ? (
                  match.suggestions.map((s, i) => (
                    <div className="line" key={i}>{s}</div>
                  ))
                ) : (
                  <div className="na">No specific change required.</div>
                )}
                {match.rewrite.map((x, i) => (
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
            </div>
          </section>
        </>
      )}
    </section>
  );
}
