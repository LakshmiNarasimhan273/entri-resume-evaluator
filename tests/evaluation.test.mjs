import assert from "node:assert/strict";
import test from "node:test";
import { structure, sectionLines } from "../src/services/analysis/structure.js";
import { evaluate } from "../src/services/evaluation/evaluate.js";
import { COURSE_CONFIG } from "../src/config/resumeConfig.js";
import { makeParsed, NESTED_SKILLS, FLAT_SKILLS } from "./fixtures/syntheticResume.js";

const course = "Data Analytics";
const role = Object.keys(COURSE_CONFIG[course].roles)[0];
const run = (lines, step) => {
  const parsed = makeParsed(lines, step);
  const st = structure(parsed);
  const result = evaluate(parsed, st, { course, role, level: "Fresher / Entry-Level" });
  return { parsed, st, result, by: (k) => result.reviews.find((r) => r.key === k) };
};

for (const [name, lines] of [["nested Key Skills", NESTED_SKILLS], ["flat Technical Skills", FLAT_SKILLS]]) {
  for (const step of [16, 34]) {
    test(`skills: ${name} (row gap ${step}) raises no heading/space correction`, () => {
      const { by } = run(lines, step);
      const text = by("skills").suggest.join(" ");
      assert.ok(!/rename the current heading/i.test(text), "no rename suggestion");
      assert.ok(!/vertical space|Compress it/i.test(text), "no vertical-space suggestion");
      assert.ok(by("visual").suggest.every((s) => !/heading-name improvements/i.test(s)));
    });
  }
}

test("skills: nested sub-headings do not truncate the skills block", () => {
  const { parsed, st } = run(NESTED_SKILLS);
  const txt = sectionLines(parsed, st, "skills").map((l) => l.text).join(" ");
  assert.match(txt, /Python, SQL/);
  assert.match(txt, /Communication, Teamwork/);
  assert.ok(st.hits.some((h) => h.key === "skills" && h.sub), "sub-heading flagged");
});

test("projects: copy-ready text never equals the resume text", () => {
  const { by } = run(NESTED_SKILLS);
  const original = NESTED_SKILLS.map((l) => l[0].toLowerCase());
  const rewrites = by("projects").rewrite;
  assert.ok(rewrites.length > 0);
  for (const rw of rewrites) {
    for (const line of rw.text.split("\n").map((l) => l.replace(/^•\s*/, "").toLowerCase())) {
      assert.ok(!original.includes(line), `echoed resume line: ${line}`);
    }
  }
});

test("projects: weak openers are rewritten and gaps are bracketed, not invented", () => {
  const rw = run(NESTED_SKILLS).by("projects").rewrite.find((x) => /Sales Dashboard/.test(x.label));
  assert.match(rw.text, /Built a dashboard/);
  assert.match(rw.text, /Supported cleaning/);
  assert.match(rw.text, /\[Result:/);
});

test("projects: a fully-described project produces no copy card", () => {
  const rewrites = run(NESTED_SKILLS).by("projects").rewrite;
  assert.ok(!rewrites.some((x) => /Customer Churn/.test(x.label)));
});

test("skills: copy-ready is grouped into sub-categories and lists only detected skills", () => {
  const rw = run(FLAT_SKILLS).by("skills").rewrite[0];
  assert.match(rw.label, /grouped for/);
  assert.match(rw.text, /^Technical Skills\n/);
  assert.match(rw.text, /Databases: SQL/);
  assert.match(rw.text, /Data Analysis & Visualization: .*Power BI/);
  assert.match(rw.text, /Programming Languages: Python/);
  assert.ok(!/React|Docker|Figma/.test(rw.text), "no invented skills");
});

test("skills: nested Key Skills resume gets a Key Skills > Technical/Soft copy-ready", () => {
  const rw = run(NESTED_SKILLS).by("skills").rewrite[0];
  assert.match(rw.text, /^Key Skills\nTechnical Skills\n/);
  assert.match(rw.text, /Soft Skills\nCommunication, Teamwork, Problem Solving/);
});

test("skills: group order follows the selected role", () => {
  const order = (c) => {
    const r = Object.keys(COURSE_CONFIG[c].roles)[0];
    const parsed = makeParsed(FLAT_SKILLS);
    const res = evaluate(structure(parsed) && parsed, structure(parsed), { course: c, role: r, level: "Fresher / Entry-Level" });
    return res.reviews.find((x) => x.key === "skills").rewrite[0].text.split("\n").slice(1, 3);
  };
  assert.notDeepEqual(order("Data Analytics"), order("Data Science"));
});

test("FSD course offers exactly the five agreed roles, in order", () => {
  assert.deepEqual(Object.keys(COURSE_CONFIG.FSD.roles), [
    "MERN Stack Developer",
    "Backend Developer",
    "Frontend Developer",
    "Gen AI Full Stack Developer",
    "Agentic Full Stack Developer",
  ]);
});

function res_text_for(role) {
  const parsed = makeParsed([
    ["Ananya R", 20], ["ananya@gmail.com | +91 98765 43210 | Coimbatore | linkedin.com/in/ananya"],
    ["Technical Skills", 13], ["Node, Express, MongoDB, REST API, JWT, React, Git"],
    ["Projects", 13], ["Shop API | Node | GitHub"], ["Built an API"], ["Education", 13], ["B.Sc CS 2024"],
  ]);
  const res = evaluate(parsed, structure(parsed), { course: "FSD", role, level: "Fresher / Entry-Level" });
  return res.reviews.find((r) => r.key === "skills").rewrite[0].text;
}

test("FSD: every role evaluates and gets a role-specific grouped skills copy-ready", () => {
  const lines = [
    ["Ananya R", 20],
    ["ananya@gmail.com | +91 98765 43210 | Coimbatore, Tamil Nadu | linkedin.com/in/ananya"],
    ["Technical Skills", 13],
    ["JavaScript, React, Node.js, Express, MongoDB, HTML, CSS, Git, GitHub, REST API, JWT, OpenAI, LangChain, RAG"],
    ["Projects", 13],
    ["AI Chat App | React, Node, OpenAI | GitHub"],
    ["Built a chatbot using the OpenAI API with a React frontend and Express backend"],
    ["Education", 13],
    ["B.Sc Computer Science 2024"],
  ];
  const seen = new Set();
  for (const role of Object.keys(COURSE_CONFIG.FSD.roles)) {
    const parsed = makeParsed(lines);
    const res = evaluate(parsed, structure(parsed), { course: "FSD", role, level: "Fresher / Entry-Level" });
    const rw = res.reviews.find((r) => r.key === "skills").rewrite[0];
    assert.match(rw.label, new RegExp(role));
    seen.add(rw.text.split("\n").slice(1, 3).join("|"));
  }
  assert.ok(seen.size >= 3, "group order differs across roles");
  const first = (role) => {
    const parsed = makeParsed(lines);
    const res = evaluate(parsed, structure(parsed), { course: "FSD", role, level: "Fresher / Entry-Level" });
    return res.reviews.find((r) => r.key === "skills").rewrite[0].text.split("\n")[1].split(":")[0];
  };
  assert.equal(first("Gen AI Full Stack Developer"), "Generative AI");
  assert.equal(first("Agentic Full Stack Developer"), "Generative AI");
  assert.equal(first("Frontend Developer"), "Frontend");
  assert.ok(!/REST API, REST API/.test(res_text_for("MERN Stack Developer")), "no duplicate labels");
});

test("Agentic FSD offers the same five roles as FSD and evaluates each", () => {
  assert.deepEqual(Object.keys(COURSE_CONFIG["Agentic FSD"].roles), Object.keys(COURSE_CONFIG.FSD.roles));
  assert.deepEqual(COURSE_CONFIG["Agentic FSD"].certs, COURSE_CONFIG.FSD.certs);
  for (const role of Object.keys(COURSE_CONFIG["Agentic FSD"].roles)) {
    const parsed = makeParsed(NESTED_SKILLS);
    const res = evaluate(parsed, structure(parsed), { course: "Agentic FSD", role, level: "Fresher / Entry-Level" });
    assert.equal(res.reviews.length, 8);
  }
});
