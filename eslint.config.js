import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
];
