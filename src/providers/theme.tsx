"use client";

import { ThemeProvider } from "next-themes";

/**
 * Toggles the `dark-mode` / `light-mode` class on <html>. next-themes injects a blocking script that
 * applies the stored or system theme before the first paint, so there is no flash on load.
 */
export function Theme({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" value={{ light: "light-mode", dark: "dark-mode" }} enableSystem disableTransitionOnChange>
            {children}
        </ThemeProvider>
    );
}
