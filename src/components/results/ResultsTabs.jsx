import { useState } from "react";
import TabBar from "../common/TabBar.jsx";
import BackToTop from "../common/BackToTop.jsx";
import Results from "./Results.jsx";
// import JobMatch from "../jobmatch/JobMatch.jsx";

const TABS = [
  ["evaluation", "Resume Evaluation"],
  // ["jd", "Job Description Match"],
];

/** Sticky tab bar. Both panels stay mounted so nothing is lost when switching tabs. */
export default function ResultsTabs({ result, learner }) {
  const [tab, setTab] = useState("evaluation");
  const [jd, setJd] = useState("");

  const change = (t) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="tabs-gap" />
      <TabBar tabs={TABS} active={tab} onChange={change} />
      <div hidden={tab !== "evaluation"}>
        <Results result={result} learner={learner} />
      </div>
      {/* <div hidden={tab !== "jd"}>
        <JobMatch result={result} jd={jd} setJd={setJd} />
      </div> */}
      <div className="back-wrap">
        <BackToTop />
      </div>
    </>
  );
}
