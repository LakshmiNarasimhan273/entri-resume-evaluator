import { norm } from '../../utils/helpers.js';
import { CERT_ISSUER, COURSE_CONFIG, STANDARD, SECTION_WEIGHTS } from '../../config/resumeConfig.js';
import { tidyEvidence, addReview, cleanLine, hasActionVerb, uniq, includesAny, detectEmail, detectPhone, detectCityState, urlHas, isStandardHeading, recommendedHeading } from '../analysis/text.js';
import { firstHit, sectionLines, headerText, normalizedMatchText, termPresent, termsFound, topDetectedSkills, prettySkill } from '../analysis/structure.js';
import { buildGroupedSkills } from '../analysis/skillGroups.js';
import { evidenceToolPool, certNorm, validIssuer, githubRepoUrls, invalidGithubProjectUrls, liveUrls, portfolioUrls, looksLikeProjectTitle, splitProjectBlocks, estimateProjects, projectDateValue, projectQuality, buildProjectRewrite, meaningfulRewriteBullet, sectionActualText, looksLikeEntriPrimaryCertificate, thirdPartyCredentialPresent, standardHeadingSuggestion, scoreFromDeductions } from '../analysis/sections.js';

function evaluate(parsed, st, { course, role, level }) {
  const courseCfg = COURSE_CONFIG[course],
    roleCfg = courseCfg.roles[role];
  const full = norm(parsed.text),
    header = headerText(parsed, st),
    reviews = [];

  const hSummary = firstHit(st, "summary"),
    hSkills = firstHit(st, "skills"),
    hProjects = firstHit(st, "projects"),
    hExperience = firstHit(st, "experience"),
    hEducation = firstHit(st, "education"),
    hCert = firstHit(st, "certifications");
  const summaryLines = sectionLines(parsed, st, "summary"),
    skillLines = sectionLines(parsed, st, "skills"),
    projectLines = sectionLines(parsed, st, "projects"),
    experienceLines = sectionLines(parsed, st, "experience"),
    educationLines = sectionLines(parsed, st, "education"),
    certLines = sectionLines(parsed, st, "certifications");

  // 1 HEADER
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const email = detectEmail(header),
      phone = detectPhone(header),
      loc = detectCityState(header);
    const firstPageCombined = [
      header,
      parsed.pages[0]?.text || "",
      ...(parsed.pages[0]?.urls || []),
    ].join(" ");
    const linkedin =
      /linkedin/i.test(firstPageCombined) ||
      urlHas(parsed.urls, /linkedin\.com/i);
    const github =
      /github/i.test(firstPageCombined) ||
      urlHas(parsed.urls, /github\.com/i);
    const leetcode =
      /leetcode/i.test(firstPageCombined) ||
      urlHas(parsed.urls, /leetcode\.com/i);
    const portfolio =
      /portfolio|behance|dribbble|figma/i.test(firstPageCombined) ||
      portfolioUrls(parsed.urls).length > 0;
    const firstLine = (st.pageLines[1] || [])[0]?.text || "";
    if (firstLine && firstLine.split(/\s+/).length <= 6)
      good.push(`Name is clearly placed at the top: ${firstLine}.`);
    else
      suggest.push(
        "Keep the learner's full name clearly at the top in a larger bold font.",
      );
    if (phone)
      good.push(
        "Phone number was detected from the page-1 visual/header scan.",
      );
    else
      suggest.push(
        "A phone number could not be confirmed from either the page image or PDF text. Check that it is clearly visible in the header.",
      );
    if (email)
      good.push(
        "Professional email was detected from the page-1 visual/header scan.",
      );
    else
      suggest.push(
        "A professional email could not be confirmed from either the page image or PDF text. Check that it is clearly visible in the header.",
      );
    if (loc) good.push("City and State are visible.");
    else suggest.push("Add current location as City, State.");
    if (linkedin) good.push("LinkedIn profile is included.");
    if (github) good.push("GitHub profile/repository link is included.");
    if (leetcode) good.push("LeetCode/coding profile is included.");
    if (portfolio) good.push("Portfolio/design profile is included.");

    if (["FSD", "Agentic FSD", "Python Development"].includes(course) && !github)
      suggest.push(
        "Add the learner's GitHub profile in the header because it is important for the selected development role.",
      );
    if (course === "UI UX" && !portfolio)
      suggest.push(
        "Add a portfolio link (for example Figma/Behance/portfolio site) because portfolio evidence is important for UI/UX roles.",
      );
    if (
      [
        "Data Analytics",
        "Data Science",
        "Cyber Security",
        "Flutter",
      ].includes(course) &&
      !linkedin
    )
      suggest.push(
        "LinkedIn is recommended if the learner has an updated professional profile.",
      );
    let deductions = 0;
    if (!phone) deductions += 1;
    if (!email) deductions += 1;
    if (!loc) deductions += 0.5;
    if (["FSD", "Agentic FSD", "Python Development"].includes(course) && !github)
      deductions += 1;
    if (course === "UI UX" && !portfolio) deductions += 1;
    addReview(
      reviews,
      "header",
      "1. Header & Contact Details",
      scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      false,
      tidyEvidence(header, 220),
    );
  }

  // 2 SUMMARY
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("summary", hSummary);
    if (hSuggest) suggest.push(hSuggest);
    const stext = sectionActualText(summaryLines);
    if (!hSummary) {
      suggest.push("Add a Professional Summary below the header.");
    } else {
      const words = stext.split(/\s+/).filter(Boolean).length;
      if (words >= 20 && words <= 75)
        good.push(`Summary length is appropriate (${words} words).`);
      else if (words > 75)
        suggest.push(
          `The summary is long (${words} words). Keep it to 2–3 concise sentences.`,
        );
      else
        suggest.push(
          `The summary is very brief (${words} words). Add enough detail to show the target role, relevant skills and practical exposure.`,
        );
      const matched = topDetectedSkills(roleCfg, stext);
      if (matched.length >= 3)
        good.push(
          `Summary includes role-relevant terms such as ${matched.join(", ")}.`,
        );
      else
        suggest.push(
          `Align the summary more clearly to the preferred role '${role}' using genuine role-relevant skills.`,
        );
      const generic = [
        "hardworking",
        "quick learner",
        "team player",
        "open to work",
        "looking for job",
        "any suitable position",
        "seeking a challenging position",
      ].filter((x) => norm(stext).includes(x));
      if (generic.length)
        suggest.push(
          `Remove generic wording such as: ${generic.join(", ")}.`,
        );
    }
    const detectedSkills = topDetectedSkills(roleCfg, parsed.text).map(
      prettySkill,
    );
    const hasRelevantInternship =
      /\b(data analyst intern|data analytics intern|data science intern|python developer intern|full stack.*intern|flutter.*intern|cyber.*intern|ui.?ux.*intern)\b/i.test(
        parsed.text,
      );
    const expYears = (stext.match(/\b(\d+)\+?\s+years?\b/i) || [])[1];
    if (hasRelevantInternship && /\baspiring\b/i.test(stext)) {
      suggest.push(
        `Because relevant internship experience is already present, replace 'aspiring ${role}' with a more evidence-based positioning such as '${role} with hands-on internship experience'.`,
      );
    }
    if (detectedSkills.length) {
      const prefix = hasRelevantInternship
        ? `${role} with hands-on internship experience`
        : expYears
          ? `${role} with ${expYears} years of transferable professional experience and hands-on analytics/technical exposure`
          : `Entry-level ${role}`;
      const projectEvidence = hProjects
        ? `Applied ${detectedSkills.slice(0, 4).join(", ")} through practical projects aligned to ${roleCfg.summaryFocus}.`
        : `Skilled in ${detectedSkills.slice(0, 4).join(", ")}.`;
      const focusAlready = norm(projectEvidence).includes(
        norm(roleCfg.summaryFocus),
      );
      const summaryRewrite = focusAlready
        ? `${prefix}. ${projectEvidence}`
        : `${prefix}. ${projectEvidence} Focused on ${roleCfg.summaryFocus}.`;
      if (!hSummary || suggest.length)
        rewrite.push({
          label: "Copy-ready Professional Summary",
          text: summaryRewrite,
        });
    }
    let deductions = !hSummary ? 2 : 0;
    if (hSummary) {
      const words = stext.split(/\s+/).filter(Boolean).length;
      if (words < 18 || words > 85) deductions += 1;
      if (topDetectedSkills(roleCfg, stext).length < 2) deductions += 1;
    }
    addReview(
      reviews,
      "summary",
      "2. Professional Summary",
      scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      false,
      tidyEvidence(stext, 220),
    );
  }

  // 3 SKILLS
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("skills", hSkills);
    if (hSuggest) suggest.push(hSuggest);
    const rawSkills = sectionActualText(skillLines);
    const stxt = normalizedMatchText(rawSkills);

    if (!hSkills) {
      suggest.push(
        "A clear skills/technologies section could not be identified. If skills are present under another heading, rename that heading to 'Technical Skills', or use 'Key Skills' with 'Technical Skills' and 'Soft Skills' as sub-headings (both formats are accepted).",
      );
    } else {
      if (!isStandardHeading("skills", hSkills.actual))
        good.push(
          `Skills content is present under the heading '${hSkills.actual}'.`,
        );

      const nestedSkillHeadings = st.hits.filter(
        (h) => h.key === "skills" && h.sub,
      );
      if (nestedSkillHeadings.length)
        good.push(
          `Skills are grouped under '${hSkills.actual}' with nested sub-headings. This is an accepted, space-efficient format.`,
        );

      const mustFound = termsFound(stxt, roleCfg.must);
      const mustMissing = roleCfg.must.filter(
        (x) => !termPresent(stxt, x),
      );
      if (mustFound.length)
        good.push(
          `Core role skills present: ${mustFound.map(prettySkill).join(", ")}.`,
        );
      if (mustMissing.length)
        suggest.push(
          `Missing/weak ATS terms for '${role}': ${mustMissing.slice(0, 6).map(prettySkill).join(", ")}. Add only skills the learner has genuinely used or learned.`,
        );

      const altMissing = roleCfg.alt
        .filter((g) => !g.some((x) => termPresent(stxt, x)))
        .map((g) => g.map(prettySkill).join(" OR "));
      if (altMissing.length)
        suggest.push(
          `If genuinely used, one supported option from these groups can strengthen ATS alignment: ${altMissing.join("; ")}.`,
        );

      const lines = skillLines.filter(
        (x) => cleanLine(x.text).length > 0,
      );
      if (lines.length >= 2)
        good.push(
          "Skills are separated into multiple lines/categories rather than one large paragraph.",
        );
      else if ((stxt.match(/,/g) || []).length >= 8)
        suggest.push(
          "Group the Skills section into simple categories instead of one long list.",
        );

      // Specific database wording.
      if (termPresent(stxt, "sql")) {
        if (termPresent(stxt, "mysql"))
          good.push(
            "MySQL is explicitly identified as the database technology.",
          );
        else if (
          !["postgresql", "sql server", "sqlite", "oracle"].some((x) =>
            termPresent(stxt, x),
          )
        ) {
          suggest.push(
            "SQL is listed, but the database platform is not specified. If the learner used MySQL, write 'MySQL' explicitly; otherwise name the actual database used.",
          );
        }
      }
      if (/\bmy\s+sql\b/i.test(rawSkills))
        suggest.push(
          "Standardise the database name from 'My SQL' to 'MySQL'.",
        );

      // Check whether major tools listed in Skills are supported by Projects.
      if (hProjects) {
        const ptxt = normalizedMatchText(sectionActualText(projectLines));
        const listedTools = evidenceToolPool(course).filter((x) =>
          termPresent(stxt, x),
        );
        const unsupported = listedTools.filter(
          (x) => !termPresent(ptxt, x),
        );
        if (unsupported.length) {
          suggest.push(
            `These listed tools are not clearly evidenced in the Projects section: ${unsupported.map(prettySkill).join(", ")}. Keep them only if the learner can demonstrate them, or add genuine project evidence.`,
          );
        }
      }
    }

    // Ready-to-copy skill line uses ONLY skills actually detected in this resume.
    const pool = uniq([
      ...roleCfg.must,
      ...roleCfg.concepts,
      ...roleCfg.alt.flat(),
      ...evidenceToolPool(course),
    ]);
    // Grouped into sub-categories, ordered by relevance to the target role.
    const grouped = buildGroupedSkills(roleCfg, stxt, pool);
    if (grouped.technicalCount) {
      const nested = /key skills/i.test(hSkills?.actual || "");
      const textLines = [
        ...(nested ? ["Key Skills"] : []),
        "Technical Skills",
        ...grouped.lines,
      ];
      if (grouped.soft.length)
        textLines.push("", "Soft Skills", grouped.soft.join(", "));
      rewrite.push({
        label: `Copy-ready Skills — grouped for ${role}`,
        text: textLines.join("\n"),
      });
      if (grouped.groupNames.length > 1)
        suggest.push(
          `For '${role}', lead with the groups most relevant first: ${grouped.groupNames.slice(0, 3).join(" → ")}. The copy-ready version is ordered that way and uses only skills found in this resume.`,
        );
    }

    let deductions = !hSkills ? 2 : 0;
    if (hSkills) {
      const mustMissing = roleCfg.must.filter(
        (x) => !termPresent(stxt, x),
      );
      deductions += Math.min(2, mustMissing.length * 0.35);
      const unsupported = evidenceToolPool(course).filter(
        (x) =>
          termPresent(stxt, x) &&
          hProjects &&
          !termPresent(sectionActualText(projectLines), x),
      );
      deductions += Math.min(1, unsupported.length * 0.25);
    }
    addReview(
      reviews,
      "skills",
      "3. Skills & ATS Alignment",
      scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      false,
      tidyEvidence(rawSkills, 220),
    );
  }
  // 4 PROJECTS
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("projects", hProjects);
    if (hSuggest) suggest.push(hSuggest);
    let projectCount = 0,
      projectBlocks = [];

    if (!hProjects) {
      if (level !== "2+ Years Experience")
        suggest.push(
          "Add a Projects section. For freshers/early-career learners, projects are a major source of practical evidence.",
        );
      else
        suggest.push(
          "Add Projects when they strengthen the selected role; otherwise strong relevant Experience can carry more weight.",
        );
    } else {
      projectBlocks = splitProjectBlocks(projectLines);
      projectCount = projectBlocks.length;
      good.push(
        `Project content is present with ${projectCount} project${projectCount === 1 ? "" : "s"} detected.`,
      );
      if (isStandardHeading("projects", hProjects.actual))
        good.push(
          `Section heading '${hProjects.actual}' is ATS-friendly.`,
        );
      else
        good.push(
          `Projects were recognised under the heading '${hProjects.actual}'.`,
        );

      const ptxt = normalizedMatchText(sectionActualText(projectLines));
      const evidence = roleCfg.project.filter((x) =>
        termPresent(ptxt, x),
      );
      if (evidence.length >= 3)
        good.push(
          `Projects show role-relevant evidence such as ${evidence.slice(0, 6).map(prettySkill).join(", ")}.`,
        );
      else
        suggest.push(
          `Projects need stronger '${role}' evidence. Make the problem, tools/method, learner contribution and output easier to see.`,
        );

      const qualities = projectBlocks.map((b) => ({
        block: b,
        q: projectQuality(b, roleCfg),
      }));
      const withProblem = qualities.filter((x) => x.q.problem).length;
      const withMethod = qualities.filter((x) => x.q.methodology).length;
      const withAction = qualities.filter(
        (x) => x.q.contribution > 0,
      ).length;
      const withMeasure = qualities.filter((x) => x.q.measurable).length;
      const withInsight = qualities.filter((x) => x.q.insight).length;

      if (projectCount) {
        if (withProblem === projectCount)
          good.push(
            "Each detected project explains a problem/objective or analytical purpose.",
          );
        else
          suggest.push(
            `${projectCount - withProblem} of ${projectCount} project(s) do not clearly state the problem/objective. Add one short line explaining what the project was trying to analyse, solve, predict or improve.`,
          );

        if (withMethod === projectCount)
          good.push(
            "Projects clearly show role-relevant tools/methodology.",
          );
        else
          suggest.push(
            `${projectCount - withMethod} of ${projectCount} project(s) need clearer methodology/tool evidence.`,
          );

        if (withAction === projectCount)
          good.push(
            "Each project contains at least one action-led contribution statement.",
          );
        else
          suggest.push(
            `${projectCount - withAction} of ${projectCount} project(s) do not clearly show the learner's contribution. Use action verbs such as Analyzed, Built, Cleaned, Developed, Designed, Implemented or Evaluated where accurate.`,
          );

        if (withMeasure < projectCount) {
          suggest.push(
            `${projectCount - withMeasure} of ${projectCount} project(s) have no measurable outcome. Where genuine, quantify dataset size, records analysed, accuracy, KPI change, time saved, users, transactions or another concrete output.`,
          );
        } else
          good.push("All detected projects contain measurable evidence.");

        if (withInsight < projectCount) {
          suggest.push(
            `${projectCount - withInsight} of ${projectCount} project(s) do not clearly state the insight/impact. Add what the analysis/model revealed or what business/technical outcome the work produced.`,
          );
        } else
          good.push(
            "Projects clearly communicate insights/results or impact.",
          );
      }

      // Most recent project first when dates are available.
      const dated = projectBlocks
        .map((b) => ({
          b,
          d: projectDateValue(b.lines.map((x) => x.text).join(" ")),
        }))
        .filter((x) => x.d);
      if (dated.length >= 2) {
        const values = dated.map((x) => x.d);
        const descending = values.every(
          (v, i) => i === 0 || values[i - 1] >= v,
        );
        if (!descending)
          suggest.push(
            "Project dates are available, but the order is not newest-first. Move the most recently completed and strongest role-aligned project to the top.",
          );
        else
          good.push(
            "Dated projects are ordered with the most recent project first.",
          );
      }

      // GitHub link quality.
      const invalidGh = invalidGithubProjectUrls(parsed.urls);
      if (invalidGh.length) {
        suggest.push(
          `${invalidGh.length} GitHub project link(s) appear to point to a commit/blob/tree or other sub-page instead of the repository root. Replace each with the main repository URL (github.com/user/repository).`,
        );
      }

      if (courseCfg.projectLinks === "required") {
        const gh = githubRepoUrls(parsed.urls),
          live = liveUrls(parsed.urls);
        if (gh.length >= projectCount)
          good.push(
            "Repository-root GitHub links are available for the detected projects.",
          );
        else
          suggest.push(
            `Add a correct repository-root GitHub link for each project. ${projectCount} project(s) were detected and ${gh.length} valid repository-root link(s) were found.`,
          );
        if (live.length >= projectCount)
          good.push(
            "Live/deployed project links are available for the detected projects.",
          );
        else
          suggest.push(
            `Add a working live/deployed link for each project. ${projectCount} project(s) were detected and ${live.length} live link(s) were found.`,
          );
      }
      if (
        courseCfg.projectLinks === "portfolio" &&
        portfolioUrls(parsed.urls).length
      )
        good.push(
          "Portfolio/design link is available to support project work.",
        );

      // Copy-ready project descriptions: improved wording + clearly marked gaps,
      // never a repeat of the resume text.
      for (const b of projectBlocks) {
        const rw = buildProjectRewrite(b, course, roleCfg);
        if (rw) rewrite.push(rw);
        if (rewrite.length >= 3) break;
      }
    }

    let deductions =
      !hProjects && level !== "2+ Years Experience" ? 2.5 : 0;
    if (hProjects) {
      const ptxt = normalizedMatchText(sectionActualText(projectLines));
      const evidence = roleCfg.project.filter((x) =>
        termPresent(ptxt, x),
      );
      if (evidence.length < 3) deductions += 1;
      const blocks = projectBlocks.length
        ? projectBlocks
        : splitProjectBlocks(projectLines);
      const qualities = blocks.map((b) => projectQuality(b, roleCfg));
      if (qualities.length) {
        const weak = qualities.filter(
          (q) =>
            !q.problem ||
            !q.methodology ||
            q.contribution === 0 ||
            !q.insight,
        ).length;
        deductions += Math.min(1.75, weak * 0.45);
        const noMeasure = qualities.filter((q) => !q.measurable).length;
        deductions += Math.min(0.75, noMeasure * 0.2);
      }
      if (invalidGithubProjectUrls(parsed.urls).length) deductions += 0.5;
      if (courseCfg.projectLinks === "required") {
        const pc = Math.max(1, blocks.length);
        if (githubRepoUrls(parsed.urls).length < pc) deductions += 0.75;
        if (liveUrls(parsed.urls).length < pc) deductions += 0.75;
      }
    }

    addReview(
      reviews,
      "projects",
      "4. Projects / Technical Projects",
      scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      false,
      tidyEvidence(sectionActualText(projectLines), 240),
    );
  }
  // 5 EDUCATION
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("education", hEducation);
    if (hSuggest) suggest.push(hSuggest);
    let na = false,
      deductions = 0;

    if (!hEducation) {
      // Education is conditional, not universally mandatory.
      na = true;
      good.push(
        "No Education penalty is applied because Education is not mandatory for every learner profile.",
      );
    } else {
      if (!isStandardHeading("education", hEducation.actual)) {
        good.push(
          `Education content is present under the heading '${hEducation.actual}'.`,
        );
      } else {
        good.push("Education section is clearly identified.");
      }

      const etxt = norm(sectionActualText(educationLines));
      const years = [...etxt.matchAll(/\b(20\d{2})\b/g)].map((m) =>
        Number(m[1]),
      );
      const latest = years.length ? Math.max(...years) : null;
      const relevant = includesAny(etxt, courseCfg.education);

      if (latest)
        good.push(
          `Education year/duration information is visible (${latest}).`,
        );

      if (relevant) {
        good.push(
          `The qualification contains terms aligned with the selected course/role.`,
        );
        if (!latest) {
          suggest.push(
            "Because this education appears relevant to the preferred role, add the completion year or duration if it is not already clearly visible.",
          );
          deductions += 0.75;
        }
      } else {
        // Do not automatically label a qualification irrelevant.
        good.push(
          "Education details are present. Role relevance is not automatically judged unless it is clearly supported by the qualification text.",
        );
      }

      // Only give placement guidance when old year is explicit.
      if (latest && latest < 2020 && !relevant) {
        suggest.push(
          "This qualification is from before 2020 and is not clearly role-aligned from the visible text. If it is unrelated to the preferred role, keep Education lower in the resume; if it is relevant, retain it normally.",
        );
      }
    }

    addReview(
      reviews,
      "education",
      "5. Education",
      na ? 0 : scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      na,
      tidyEvidence(sectionActualText(educationLines), 220),
    );
  }
  // 6 EXPERIENCE
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("experience", hExperience);
    if (hSuggest) suggest.push(hSuggest);
    let na = false,
      deductions = 0;
    const inferredRelevantExperience =
      /\b(data analyst intern|data analytics intern|data science intern|python developer intern|full stack.*intern|flutter.*intern|cyber.*intern|ui.?ux.*intern|freelance|internship)\b/i.test(
        parsed.text,
      );

    if (!hExperience) {
      if (inferredRelevantExperience) {
        suggest.push(
          "Relevant internship/experience content appears to be present, but a clear 'Experience' or 'Internship' section heading was not confidently detected. Group that content under a standard heading so recruiters and ATS can identify it.",
        );
        deductions = 1.25;
        const candidateLines = Object.values(st.pageLines)
          .flat()
          .filter((x) =>
            /\b(intern|freelance|analyst|developer|designer)\b/i.test(
              x.text,
            ),
          )
          .slice(0, 5);
        if (candidateLines.length)
          good.push(
            "Role-related experience/internship evidence is present in the resume.",
          );
      } else if (level === "Fresher / Entry-Level") {
        na = true;
        good.push(
          "No Experience section is required for a fresher when the learner has no genuine prior work/internship experience.",
        );
      } else {
        na = true;
        suggest.push(
          "If the learner has genuine work/internship experience, add it. Do not create an Experience section only to satisfy the evaluator.",
        );
      }
    } else {
      if (!isStandardHeading("experience", hExperience))
        good.push(
          `Experience content is present under the heading '${hExperience.actual}'.`,
        );
      else good.push("Experience/Internship section is present.");
      const substantive = experienceLines.filter(
        (x) => cleanLine(x.text).split(/\s+/).length >= 6,
      );
      if (substantive.length >= 3)
        good.push(
          "Experience includes descriptive responsibility/achievement lines.",
        );
      else {
        suggest.push(
          "Use 3–5 concise bullets per role/internship showing responsibilities, tools and outcomes.",
        );
        deductions += 1;
      }
      const weak = substantive.filter((x) => !hasActionVerb(x.text));
      if (weak.length) {
        suggest.push(
          "Start more Experience bullets with clear action verbs.",
        );
        deductions += 0.75;
      }
      const long = substantive.filter(
        (x) => cleanLine(x.text).split(/\s+/).length > 30,
      );
      if (long.length) {
        suggest.push(
          `${long.length} Experience line(s) are too long. Keep each bullet focused on one action and outcome.`,
        );
        deductions += 0.5;
      }
      const improved = weak[0]
        ? meaningfulRewriteBullet(weak[0].text, course)
        : "";
      if (improved)
        rewrite.push({
          label: "Copy-ready improvement of an Experience line",
          text: improved,
        });
    }
    addReview(
      reviews,
      "experience",
      "6. Experience / Internship",
      na ? 0 : scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      na,
      tidyEvidence(sectionActualText(experienceLines), 220),
    );
  }
  // 7 CERTIFICATIONS
  {
    const good = [],
      suggest = [],
      rewrite = [];
    const hSuggest = standardHeadingSuggestion("certifications", hCert);
    if (hSuggest) suggest.push(hSuggest);
    let na = false,
      deductions = 0;

    if (!hCert) {
      na = true;
      good.push(
        "No certification issue is evaluated because a Certifications section is not present.",
      );
    } else {
      if (!isStandardHeading("certifications", hCert))
        good.push(
          `Certification content is present under the heading '${hCert.actual}'.`,
        );
      const raw = sectionActualText(certLines),
        t = certNorm(raw);
      const exact = courseCfg.certs.find((c) => t.includes(certNorm(c)));
      const thirdParty = thirdPartyCredentialPresent(raw);
      const looksPrimary = looksLikeEntriPrimaryCertificate(
        raw,
        courseCfg,
      );

      if (exact) {
        good.push(
          `Approved Entri course certification name detected: ${exact}.`,
        );
        if (validIssuer(raw))
          good.push(
            `Issuing organisation '${CERT_ISSUER}' is correctly represented for the Entri course certificate.`,
          );
        else {
          suggest.push(
            `For the Entri course certificate '${exact}', add the issuing organisation '${CERT_ISSUER}' if it is not already shown.`,
          );
          deductions += 0.5;
        }
      } else if (looksPrimary && courseCfg.certs.length) {
        suggest.push(
          `This appears to be the Entri course-completion certificate, but the official title is not clearly matched. Verify the certificate itself before editing; if it is the primary Entri certificate, use the exact printed title: ${courseCfg.certs.join(" OR ")}.`,
        );
        deductions += 0.5;
      } else if (thirdParty) {
        good.push(
          "A third-party/NSDC/add-on credential appears to be present. Its genuine certificate name and issuing organisation should be preserved exactly as printed.",
        );
      } else {
        good.push(
          "Certification details are present. The evaluator will not replace the certificate name unless it can confidently identify it as the Entri primary course certificate.",
        );
      }

      // Only provide a copy-ready certificate line when the exact approved primary certificate is already identified.
      if (exact) {
        rewrite.push({
          label: "Copy-ready Entri certification line",
          text: `${exact}\n${CERT_ISSUER}`,
        });
      }

      if (!/\b20\d{2}\b/.test(t) && !/\b(issued|completed)\b/.test(t)) {
        suggest.push(
          "Add the issue/completion month and year if available.",
        );
        deductions += 0.25;
      }
    }

    addReview(
      reviews,
      "certifications",
      "7. Certifications",
      na ? 0 : scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      na,
      tidyEvidence(sectionActualText(certLines), 220),
    );
  }
  // 8 VISUAL / FONT / TEMPLATE
  {
    const good = [],
      suggest = [],
      rewrite = [];
    let deductions = 0;
    if (parsed.pageCount === 1)
      good.push("Resume is contained within one page.");
    if (parsed.pageCount === 2) {
      good.push(
        "A two-page resume is acceptable when the learner has enough relevant project/role content.",
      );
      if ((parsed.pages[1]?.fillRatio || 0) < 0.52) {
        suggest.push(
          "The second page is too sparse. Rebalance content or reduce the resume to one page.",
        );
        deductions += 1;
      }
    }
    if (parsed.pageCount > 2) {
      suggest.push(
        "Resume is longer than 2 pages. Reduce it unless there is a strong role-specific reason.",
      );
      deductions += 1.5;
    }

    const keyHits = st.hits.filter((h) =>
      !h.sub &&
      [
        "summary",
        "skills",
        "projects",
        "experience",
        "education",
        "certifications",
      ].includes(h.key),
    );
    const fonts = uniq(
      keyHits
        .flatMap((h) => (Array.isArray(h.fonts) ? h.fonts : []))
        .filter(Boolean)
        .map((x) => norm(x)),
    );
    const heights = keyHits.map((h) => h.avgH).filter(Boolean);
    if (fonts.length <= 2)
      good.push(
        "Section heading font usage appears reasonably consistent.",
      );
    else {
      suggest.push(
        "Section headings appear to use multiple font families. Use one consistent heading font/style.",
      );
      deductions += 1;
    }
    if (heights.length >= 3) {
      const avg = heights.reduce((a, b) => a + b, 0) / heights.length;
      const outliers = heights.filter(
        (h) => Math.abs(h - avg) / avg > 0.38,
      ).length;
      if (outliers === 0)
        good.push("Section heading sizes appear visually consistent.");
      else {
        suggest.push(
          "Heading sizes are inconsistent. Keep all section headings in a consistent hierarchy.",
        );
        deductions += 0.75;
      }
    }
    const nonstandard = st.hits.filter(
      (h) =>
        !h.sub && STANDARD[h.key] && !isStandardHeading(h.key, h.actual),
    );
    if (nonstandard.length) {
      suggest.push(
        `For better ATS consistency, consider these heading-name improvements: ${nonstandard.map((h) => `'${h.actual}' → '${recommendedHeading(h.key)}'`).join("; ")}.`,
      );
      deductions += Math.min(1, nonstandard.length * 0.25);
    } else
      good.push("Detected section names are ATS-friendly and standard.");

    if (level !== "2+ Years Experience" && parsed.pageCount === 2) {
      const pc = hProjects ? estimateProjects(projectLines) : 0;
      if (pc >= 3)
        good.push(
          `Two pages are justified by ${pc} detected projects and the amount of role-relevant content.`,
        );
    }
    addReview(
      reviews,
      "visual",
      "8. Font, Style, Template & ATS Format",
      scoreFromDeductions(5, deductions),
      good,
      suggest,
      rewrite,
      false,
      `${parsed.pageCount} page(s) detected.`,
    );
  }

  // Contextual section-order guidance appended to relevant cards.
  const recOrder = [];
  recOrder.push("Header", "Professional Summary", "Skills");
  if (level === "2+ Years Experience") {
    if (hExperience) recOrder.push("Experience");
    if (hProjects) recOrder.push("Projects");
  } else {
    const etxt = norm(sectionActualText(educationLines));
    const years = [...etxt.matchAll(/\b(20\d{2})\b/g)].map((m) =>
      Number(m[1]),
    );
    const latest = years.length ? Math.max(...years) : null;
    const relevant = hEducation && includesAny(etxt, courseCfg.education);
    if (relevant && latest && latest >= 2025) recOrder.push("Education");
    if (hProjects) recOrder.push("Projects");
    if (hExperience) recOrder.push("Experience / Internship");
  }
  if (hCert) recOrder.push("Certifications");
  if (hEducation && !recOrder.includes("Education"))
    recOrder.push("Education");
  reviews
    .find((r) => r.key === "visual")
    .suggest.unshift(
      `Recommended section order for this learner: ${recOrder.join(" → ")}.`,
    );

  // Keep star scores consistent with the feedback displayed.
  for (const r of reviews) {
    if (r.na) continue;
    const n = (r.suggest || []).length;
    if (n > 0) {
      const feedbackCap = Math.max(2.5, 4.6 - (n - 1) * 0.3);
      r.score = Math.min(r.score, feedbackCap);
    }
    // 5/5 is reserved for sections with no improvement recommendation.
    if (n > 0 && r.score >= 5) r.score = 4.6;
    r.score = Math.round(r.score * 10) / 10;
  }

  // Total score with N/A weights removed.
  let earned = 0,
    available = 0;
  for (const r of reviews) {
    const w = SECTION_WEIGHTS[r.key] || 0;
    if (r.na) continue;
    available += w;
    earned += (r.score / 5) * w;
  }
  let total = available ? Math.round((earned / available) * 100) : 0;

  // Consistency penalty: several improvement areas should not still produce a 90s score.
  const issueSections = reviews.filter(
    (r) => !r.na && (r.suggest || []).length > 0,
  );
  const suggestionCount = issueSections.reduce(
    (n, r) => n + r.suggest.length,
    0,
  );
  total = Math.max(
    0,
    total - Math.min(12, Math.max(0, suggestionCount - 2) * 0.8),
  );

  const skillReview = reviews.find((r) => r.key === "skills");
  const projectReview = reviews.find((r) => r.key === "projects");
  if (issueSections.length >= 4) total = Math.min(total, 84);
  if (skillReview && !skillReview.na && skillReview.score < 4)
    total = Math.min(total, 84);
  if (projectReview && !projectReview.na && projectReview.score < 4)
    total = Math.min(total, 84);

  total = Math.round(total);
  const ready =
    total > 85 &&
    issueSections.length <= 2 &&
    (!projectReview || projectReview.na || projectReview.score >= 4.2) &&
    (!skillReview || skillReview.na || skillReview.score >= 4.2);
  return { reviews, total, ready, course, role, level };
}

export { evaluate };
