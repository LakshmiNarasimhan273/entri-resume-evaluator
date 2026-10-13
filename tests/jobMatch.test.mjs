import assert from "node:assert/strict";
import test from "node:test";
import { matchJobDescription } from "../src/services/jobMatch/jobMatch.js";
import { splitProjectBlocks, buildProjectRewrite } from "../src/services/analysis/sections.js";
import { COURSE_CONFIG } from "../src/config/resumeConfig.js";

const resume = {
  text: "Aspiring Full-Stack Developer. Skills: JavaScript, React.js, Node.js, Express.js, MongoDB, Git, GitHub. Built a REST API with JWT authentication.",
  sections: { skills: "JavaScript, React.js, Node.js, Express.js, MongoDB, Git, GitHub", projects: "Built a REST API with JWT authentication using Express.js and MongoDB", experience: "", summary: "" },
};
const jd = `We are hiring a MERN Stack Developer. You will build responsive interfaces with React and TypeScript, create REST APIs with Node.js and Express,
store data in MongoDB, and deploy using Docker on AWS. Experience with Git and Jest testing is a plus. 2+ years of experience preferred.`;

test("job match: matches spelling variants and reports missing skills", () => {
  const r = matchJobDescription(jd, resume, { level: "Fresher / Entry-Level" });
  const m = r.matched.map((x) => x.term), miss = r.missing.map((x) => x.term);
  for (const t of ["react", "node", "express", "mongodb", "git"]) assert.ok(m.includes(t), `matched ${t}`);
  for (const t of ["typescript", "docker", "aws", "jest"]) assert.ok(miss.includes(t), `missing ${t}`);
  assert.ok(r.score > 0 && r.score < 100);
  assert.ok(r.rewrite[0].text.includes("TypeScript"));
  assert.ok(r.suggestions.some((s) => /2\+ years/.test(s)));
});

test("job match: too-short input returns a friendly error", () => {
  assert.ok(matchJobDescription("react dev", resume).error);
});

test("projects: title without a pipe is detected and not echoed as 'Implemented <title>'", () => {
  const lines = [
    "SkillSwap – Community Learning Exchange Platform",
    "Live Demo | GitHub",
    "• Developed a responsive SkillSwap platform using React.js with reusable components and modern UI.",
    "• Implemented user authentication, profile management and skill listings",
  ].map((text) => ({ text, page: 1, y: 0.5 }));
  const [block] = splitProjectBlocks(lines);
  assert.match(block.title, /^SkillSwap/);
  const roleCfg = COURSE_CONFIG["FSD"].roles["MERN Stack Developer"];
  const rw = buildProjectRewrite(block, "FSD", roleCfg);
  assert.ok(rw);
  assert.ok(!/Implemented SkillSwap/.test(rw.text));
  assert.match(rw.text, /\[Result:/);
});

import { tidyEvidence } from "../src/services/analysis/text.js";
test("evidence: joins line-break hyphens, keeps real compounds, cuts at a word boundary", () => {
  assert.match(tidyEvidence("Pro- ficient in JavaScript"), /^Proficient in/);
  assert.match(tidyEvidence("Full- stack developer"), /Full- stack/);
  const out = tidyEvidence("alpha beta gamma delta epsilon zeta eta theta iota kappa", 30);
  assert.ok(out.endsWith("…") && !/\w…$/.test(out.replace(" …", "")) && out.length <= 34, out);
});
