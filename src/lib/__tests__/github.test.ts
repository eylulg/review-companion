import { describe, expect, it } from "vitest";
import { lineUrl, parsePullRequestUrl } from "../github";

describe("parsePullRequestUrl", () => {
    it.each([
        ["https://github.com/vitejs/vite/pull/24041", { owner: "vitejs", repo: "vite", number: 24041 }],
        ["github.com/pmndrs/zustand/pull/3595/files", { owner: "pmndrs", repo: "zustand", number: 3595 }],
        ["https://www.github.com/a-b/c.d/pull/1?diff=split#top", { owner: "a-b", repo: "c.d", number: 1 }],
        ["  owner/repo#12  ", { owner: "owner", repo: "repo", number: 12 }],
        ["", null],
        ["https://github.com/owner/repo", null],
        ["https://github.com/owner/repo/issues/3", null],
        ["https://gitlab.com/o/r/pull/1", null],
        ["https://github.com/o/r/pull/0", null],
    ])("%s", (input, expected) => {
        expect(parsePullRequestUrl(input)).toEqual(expected);
    });
});

describe("lineUrl", () => {
    it.each([
        ["src/a b.ts", 4, undefined, "https://github.com/o/r/blob/abc/src/a%20b.ts#L4"],
        ["x.ts", 4, 6, "https://github.com/o/r/blob/abc/x.ts#L4-L6"],
    ])("links %s line %i", (file, line, endLine, expected) => {
        expect(lineUrl({ owner: "o", repo: "r", headSha: "abc" }, file, line, endLine)).toBe(expected);
    });
});
