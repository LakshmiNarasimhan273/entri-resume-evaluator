import { useRef, useState } from "react";

export default function UploadForm({ courses, roles, form, setForm, file, setFile, busy, status, onSubmit }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pick = (f) => {
    if (f && /\.pdf$/i.test(f.name)) setFile(f);
  };

  return (
    <section className="card form">
      <div className="formgrid">
        <div className="field">
          <label htmlFor="course">1. Course</label>
          <select id="course" value={form.course} onChange={set("course")}>
            {courses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="role">2. Preferred Job Role</label>
          <select id="role" value={form.role} onChange={set("role")}>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="learner">3. Learner Name (optional)</label>
          <input id="learner" placeholder="e.g., Ananya R" value={form.learner} onChange={set("learner")} />
        </div>
        <div className="field">
          <label htmlFor="level">4. Experience Level</label>
          <select id="level" value={form.level} onChange={set("level")}>
            <option>Fresher / Entry-Level</option>
            <option>0–2 Years Experience</option>
            <option>2+ Years Experience</option>
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1/-1" }}>
          <label>5. Upload Resume</label>
          <div
            className={`upload dropzone ${drag ? "drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".pdf" hidden onChange={(e) => pick(e.target.files[0])} />
            {file ? (
              <span>
                <b>{file.name}</b> · {(file.size / 1024).toFixed(0)} KB — click or drop to replace
              </span>
            ) : (
              <span>Drag a PDF resume here, or click to choose one</span>
            )}
          </div>
        </div>
      </div>
      <button className="btn primary" onClick={onSubmit} disabled={busy}>
        {busy ? "Evaluating..." : "Evaluate Resume"}
      </button>
      <div className="status" role="status">{status}</div>
    </section>
  );
}
