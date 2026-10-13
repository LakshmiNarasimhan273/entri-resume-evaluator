// Builds a fake "parsed PDF" so the evaluation logic can be tested without a browser.
export function makeParsed(lines, step = 16) {
  let y = 40;
  const items = lines.map(([text, h]) => {
    const it = { text, x: 40, y, w: 200, h: h || 10, font: "Arial" };
    y += step;
    return it;
  });
  const text = lines.map((l) => l[0]).join(" ");
  const urls = ["https://github.com/ananya/sales-dashboard"];
  return {
    pages: [{ page: 1, text, pdfText: text, ocrText: "", headerOCR: "", pdfItems: items, ocrLines: [],
      baseHeight: 800, cameraHeight: 1500, width: 600, fillRatio: 0.9, urls }],
    pageCount: 1, text, urls,
  };
}

const head = [
  ["Ananya R", 20],
  ["ananya@gmail.com | +91 98765 43210 | Coimbatore, Tamil Nadu | linkedin.com/in/ananya"],
  ["Professional Summary", 13],
  ["Entry-level data analyst skilled in Python, SQL and Power BI with hands-on project exposure to dashboards and analysis."],
];
const tail = [
  ["Projects", 13],
  ["Sales Dashboard | Power BI, SQL | GitHub"],
  ["Worked on building a dashboard for monthly sales data of a retail store"],
  ["Helped to clean the dataset and find trends in the data"],
  ["Customer Churn Analysis | Python, Pandas | GitHub"],
  ["Analyzed 5,000 records to predict churn with 91% accuracy using scikit-learn"],
  ["Education", 13],
  ["B.Sc Computer Science 2024"],
];

export const NESTED_SKILLS = [...head,
  ["Key Skills", 13], ["Technical Skills", 11], ["Python, SQL, Power BI, Excel, Pandas, Matplotlib"],
  ["Soft Skills", 11], ["Communication, Teamwork, Problem Solving"], ...tail];

export const FLAT_SKILLS = [...head,
  ["Technical Skills", 13], ["Python, SQL, Power BI, Excel, Pandas, Matplotlib"],
  ["Technical Skills: Statistics, Tableau"], ...tail];
