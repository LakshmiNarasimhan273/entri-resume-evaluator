import { uniq } from './text.js';
import { termPresent, prettySkill } from './structure.js';

// Ordered: a skill is placed in the FIRST group that lists it.
const SKILL_GROUPS = [
  ['Programming Languages', ['python', 'java', 'javascript', 'typescript', 'r', 'dart']],
  [
    'Testing & QA',
    [
      'selenium', 'cypress', 'playwright', 'postman', 'jest', 'manual testing',
      'automation testing', 'test automation', 'regression testing', 'smoke testing',
      'functional testing', 'api testing', 'database testing', 'bug reporting',
      'defect lifecycle', 'defect tracking', 'page object model', 'test cases',
      'test scenarios', 'test suite', 'testing', 'software testing', 'usability testing',
    ],
  ],
  [
    'Cybersecurity',
    [
      'nmap', 'wireshark', 'burp suite', 'metasploit', 'nessus', 'owasp', 'siem', 'splunk',
      'wazuh', 'penetration testing', 'vulnerability assessment', 'incident response',
      'incident handling', 'threat detection', 'log analysis', 'network security',
      'networking', 'dns', 'security', 'security monitoring', 'cybersecurity',
      'risk assessment', 'remediation', 'alert triage', 'web security',
    ],
  ],
  ['Databases', ['sql', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'nosql', 'firebase', 'database', 'vector database']],
  [
    'Data Analysis & Visualization',
    [
      'excel', 'pivot', 'pivot table', 'power bi', 'tableau', 'dax', 'matplotlib', 'seaborn',
      'dashboard', 'data visualization', 'data visualisation', 'kpi', 'business intelligence',
      'reporting', 'report automation', 'data cleaning', 'data modeling', 'data modelling',
      'eda', 'etl', 'analysis', 'statistics',
    ],
  ],
  [
    'ML Libraries & Concepts',
    [
      'pandas', 'numpy', 'scikit-learn', 'sklearn', 'tensorflow', 'pytorch', 'nlp',
      'machine learning', 'feature engineering', 'model evaluation', 'classification', 'regression',
    ],
  ],
  [
    'Generative AI',
    [
      'llm', 'openai', 'claude', 'gemini', 'langchain', 'rag', 'embeddings', 'prompt engineering',
      'agents', 'ai agents', 'chatbot', 'tool calling', 'generative ai', 'ai application', 'ai integration',
    ],
  ],
  [
    'Frontend',
    [
      'html', 'css', 'tailwind', 'react', 'redux', 'angular', 'frontend', 'responsive',
      'responsive design', 'responsive ui', 'state management', 'accessibility',
    ],
  ],
  ['Mobile (Flutter)', ['flutter', 'bloc', 'riverpod', 'provider', 'widgets']],
  [
    'Backend & APIs',
    [
      'node', 'express', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'hibernate', 'jpa',
      'backend', 'api', 'rest api', 'graphql', 'api integration', 'jwt', 'oauth', 'authentication',
      'crud', 'microservices', 'request validation', 'response validation', 'status codes',
    ],
  ],
  [
    'Cloud & DevOps',
    [
      'aws', 'gcp', 'ec2', 's3', 'iam', 'vpc', 'route 53', 'cloudwatch', 'load balancer',
      'terraform', 'ansible', 'docker', 'containers', 'jenkins', 'ci/cd', 'github actions', 'linux',
      'cloud fundamentals', 'cloud services', 'cloud deployment', 'deployment', 'deployed',
      'monitoring', 'high availability', 'scalability', 'pipeline',
    ],
  ],
  [
    'UI/UX Design',
    [
      'figma', 'adobe xd', 'photoshop', 'illustrator', 'wireframing', 'prototyping', 'typography',
      'color', 'layout', 'design system', 'components', 'ui', 'persona', 'journey map', 'user flow',
      'user research', 'information architecture', 'interaction design', 'visual design',
      'product thinking', 'user testing',
    ],
  ],
  ['Tools & Version Control', ['git', 'github']],
  [
    'Core Concepts',
    ['oop', 'oops', 'data structures', 'collections', 'exception handling', 'multithreading', 'debugging', 'troubleshooting', 'automation'],
  ],
];

// Supporting groups always come after the role-relevant technical groups.
const SUPPORT_GROUPS = new Set(['Tools & Version Control', 'Core Concepts']);

const SKILL_ALIASES = {
  oops: 'oop',
  sklearn: 'scikit-learn',
  'data modelling': 'data modeling',
  'data visualisation': 'data visualization',
  'responsive ui': 'responsive design',
  responsive: 'responsive design',
};

const SOFT_SKILL_TERMS = [
  'communication', 'teamwork', 'team collaboration', 'collaboration', 'leadership',
  'problem solving', 'critical thinking', 'analytical thinking', 'time management',
  'adaptability', 'creativity', 'attention to detail',
];

// Generic words that could false-match ordinary prose; only counted when the
// role's own config lists them.
const GENERIC_TERMS = new Set([
  'color', 'layout', 'components', 'provider', 'analysis', 'security', 'reporting', 'pipeline',
  'deployed', 'deployment', 'automation', 'testing', 'database', 'api', 'ui', 'responsive',
  'monitoring', 'scalability', 'troubleshooting', 'debugging', 'frontend', 'backend',
  'dashboard', 'pivot', 'spring', 'agents', 'widgets',
]);

/** Every recognised, non-generic skill term plus the role/course pool. */
function groupingPool(basePool) {
  return uniq([
    ...basePool,
    ...SKILL_GROUPS.flatMap(([, terms]) => terms).filter((t) => !GENERIC_TERMS.has(t)),
  ]);
}

/**
 * Groups the skills found in `stxt`, puts the groups most relevant to the
 * target role first, and returns lines ready to paste into a resume.
 * Only skills actually present in the resume are returned.
 */
function buildGroupedSkills(roleCfg, stxt, basePool) {
  const canonOf = (t) => SKILL_ALIASES[t] || t;
  const mustSet = new Set(roleCfg.must.map(canonOf));
  const conceptSet = new Set(roleCfg.concepts.map(canonOf));
  // "alt" terms are what differentiate one role from its siblings (e.g. the AI
  // tools for Gen AI vs. MERN), so they weigh more than the shared basics.
  const altSet = new Set(roleCfg.alt.flat().map(canonOf));

  const buckets = SKILL_GROUPS.map(([name, terms], order) => ({
    name, terms, order, items: [], seen: new Set(), score: 0,
  }));
  const other = { name: 'Other Tools', terms: [], order: 99, items: [], seen: new Set(), score: 0 };

  groupingPool(basePool)
    .filter((t) => !SOFT_SKILL_TERMS.includes(t) && termPresent(stxt, t))
    .forEach((t) => {
      const canon = canonOf(t);
      const bucket = buckets.find((b) => b.terms.includes(t) || b.terms.includes(canon)) || other;
      const label = prettySkill(canon);
      if (bucket.seen.has(label)) return; // e.g. "api" and "rest api" both show as REST API
      bucket.seen.add(label);
      const must = mustSet.has(canon);
      bucket.items.push({ canon, must });
      bucket.score += altSet.has(canon) ? 3 : must ? 2 : conceptSet.has(canon) ? 1 : 0;
    });

  const groups = [...buckets, other]
    .filter((b) => b.items.length)
    .sort(
      (a, b) =>
        Number(SUPPORT_GROUPS.has(a.name)) - Number(SUPPORT_GROUPS.has(b.name)) ||
        b.score - a.score ||
        a.order - b.order,
    );
  groups.forEach((g) => g.items.sort((a, b) => Number(b.must) - Number(a.must)));

  const soft = SOFT_SKILL_TERMS.filter(
    (t) => termPresent(stxt, t) && !(t === 'collaboration' && termPresent(stxt, 'team collaboration')),
  ).map(prettySkill);

  return {
    lines: groups.map((g) => `${g.name}: ${g.items.map((i) => prettySkill(i.canon)).join(', ')}`),
    groupNames: groups.map((g) => g.name),
    technicalCount: groups.reduce((n, g) => n + g.items.length, 0),
    soft,
  };
}

export { SKILL_GROUPS, SOFT_SKILL_TERMS, buildGroupedSkills };
