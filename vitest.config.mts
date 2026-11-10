import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        // The linked @eylulg/ui has its own node_modules; one copy of React is required for hooks to work.
        dedupe: ["react", "react-dom", "react-aria-components", "lucide-react"],
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        server: { deps: { inline: true } },
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        restoreMocks: true,
    },
});
