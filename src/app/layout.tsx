import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Theme } from "@/providers/theme";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "Review Companion",
    description: "Paste a GitHub pull request URL, get a structured code review from Claude, triage the findings and copy them as review comments.",
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
    ],
    colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        // next-themes sets the class before first paint, so suppress the attribute mismatch it causes.
        <html lang="en" suppressHydrationWarning>
            <body className={cx(inter.variable, "bg-primary text-primary antialiased")}>
                <Theme>{children}</Theme>
            </body>
        </html>
    );
}
