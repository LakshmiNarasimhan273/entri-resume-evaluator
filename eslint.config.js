import globals from "globals";

// Catches "x is not defined" mistakes (like a missing import) before they reach the browser.
export default [
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { "no-undef": "error" },
  },
];
