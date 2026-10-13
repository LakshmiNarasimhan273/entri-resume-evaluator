import { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/layout/Header.jsx";
import UploadForm from "./components/upload/UploadForm.jsx";
import PagePreview from "./components/preview/PagePreview.jsx";
import ResultsTabs from "./components/results/ResultsTabs.jsx";
import { useResumeEvaluation } from "./hooks/useResumeEvaluation.js";
import { COURSE_CONFIG } from "./config/resumeConfig.js";

const COURSES = Object.keys(COURSE_CONFIG);

export default function App() {
  const [form, setForm] = useState({
    course: COURSES[0],
    role: Object.keys(COURSE_CONFIG[COURSES[0]].roles)[0],
    learner: "",
    level: "Fresher / Entry-Level",
  });
  const [file, setFile] = useState(null);
  const { busy, status, pages, result, evaluate } = useResumeEvaluation();
  const resultsRef = useRef(null);

  const roles = useMemo(() => Object.keys(COURSE_CONFIG[form.course].roles), [form.course]);

  // Keep the selected role valid when the course changes.
  useEffect(() => {
    if (!roles.includes(form.role)) setForm((f) => ({ ...f, role: roles[0] }));
  }, [roles, form.role]);

  const onSubmit = async () => {
    const ok = await evaluate(file, { course: form.course, role: form.role, level: form.level });
    if (ok) setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="shell">
      <Header />
      <UploadForm
        courses={COURSES}
        roles={roles}
        form={form}
        setForm={setForm}
        file={file}
        setFile={setFile}
        busy={busy}
        status={status}
        onSubmit={onSubmit}
      />
      <PagePreview pages={pages} />
      <div ref={resultsRef}>{result && <ResultsTabs key={result.runId} result={result} learner={form.learner} />}</div>
    </div>
  );
}
