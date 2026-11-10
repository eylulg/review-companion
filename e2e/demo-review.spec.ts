import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("reviews the sample pull request end to end in demo mode", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");

    await expect(page.getByText("Demo mode.")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole("textbox", { name: "Pull request URL" }).fill("https://github.com/vitejs/vite/pull/24041");
    await page.getByRole("button", { name: "Start review" }).click();

    // Progress is announced while the saved review replays, then all findings are in.
    await expect(page.getByRole("status").filter({ hasText: /Reviewing 3 files|Reviewed \d of 3 files/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Review complete: 9 findings" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("article")).toHaveCount(9);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add search and pagination to the people table");

    // Keyboard triage: move to the second finding and accept it.
    await page.keyboard.press("j");
    await expect(page.getByRole("article").nth(1)).toBeFocused();
    await page.keyboard.press("a");
    await expect(page.getByRole("article").nth(1).getByRole("button", { name: "Accept" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 accepted, 0 dismissed")).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Export and copy.
    await page.getByRole("button", { name: "Export comments" }).click();
    const dialog = page.getByRole("dialog", { name: "Export review comments" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Markdown for 1 comment" })).toHaveValue(/Out of order responses can overwrite newer results/);
    await dialog.getByRole("button", { name: "Copy Markdown" }).click();
    await expect(dialog.getByText("Copied to clipboard.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("## Review notes for sample/team-directory#42");

    // The session survives a reload.
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByRole("article")).toHaveCount(9);
    await expect(page.getByText("1 accepted, 0 dismissed")).toBeVisible();
});

test("works at a 375px wide viewport in dark mode without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.getByRole("button", { name: /Add search and pagination to the people table/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Review complete: 9 findings" })).toBeVisible({ timeout: 20_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("reloading while a review runs shows the interrupted state, not a connection error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Pull request URL" }).fill("https://github.com/vitejs/vite/pull/24041");
    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Reviewing 3 files|Reviewed \d of 3 files/ })).toBeVisible();

    await page.reload();

    await expect(page.getByText("The page was reloaded while the review was running. Findings that arrived are kept.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run the review again" })).toBeVisible();
    await expect(page.getByText("Could not reach the server")).toHaveCount(0);
});
