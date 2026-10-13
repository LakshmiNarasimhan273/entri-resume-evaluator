export default function Stars({ score, na }) {
  if (na) return <span className="star-score">Not required</span>;
  const n = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star ${i <= n ? "on" : ""}`}>★</span>
      ))}
      <span className="star-score">{score.toFixed(1)}/5</span>
    </div>
  );
}
