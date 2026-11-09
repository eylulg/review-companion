import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const config = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
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
    {
        // Untitled UI components are copied in as they ship; keep them close to upstream.
        files: ["src/components/base/**", "src/components/application/**", "src/components/foundations/**"],
        rules: {
            "@typescript-eslint/no-empty-object-type": "off",
            "@next/next/no-img-element": "off",
            "jsx-a11y/img-redundant-alt": "off",
            "jsx-a11y/click-events-have-key-events": "off",
            "jsx-a11y/no-static-element-interactions": "off",
        },
    },
];

export default config;
