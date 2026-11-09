"use client";

import { Moon01, Sun } from "@untitledui/icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/base/buttons/button";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const hydrated = useHydrated();
    // The theme is unknown on the server; render a stable label until hydrated.
    const isDark = hydrated && resolvedTheme === "dark";

    function handleToggle() {
        setTheme(isDark ? "light" : "dark");
    }

    return (
        <Button
            color="tertiary"
            size="sm"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            iconLeading={isDark ? Sun : Moon01}
            onPress={handleToggle}
        />
    );
}
