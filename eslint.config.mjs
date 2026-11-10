import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const config = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "lighthouserc.cjs"],
    },
    {
        rules: {
            ...jsxA11y.flatConfigs.recommended.rules,
            // Radio cards nest the label text one level deeper than the default depth.
            "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "react-hooks/exhaustive-deps": "error",
            "no-console": "error",
            "no-void": "error",
            "import/no-anonymous-default-export": "error",
        },
    },
    {
        // The fixture recorder is a command line tool; its output is the console.
        files: ["scripts/**"],
        rules: { "no-console": "off" },
    },
];

export default config;
