import type { DiffFile, DiffHunk, FileStatus } from "./types";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function stripPrefix(path: string): string {
    if (path === "/dev/null") return path;
    return path.replace(/^[ab]\//, "");
}

/** Reads `a/foo b/foo` from a `diff --git` line. Paths with spaces are resolved later from ---/+++ lines. */
function pathsFromGitHeader(line: string): { oldPath: string; newPath: string } {
    const rest = line.slice("diff --git ".length);
    const splitAt = rest.indexOf(" b/");
    if (splitAt === -1) return { oldPath: stripPrefix(rest), newPath: stripPrefix(rest) };
    return { oldPath: stripPrefix(rest.slice(0, splitAt)), newPath: stripPrefix(rest.slice(splitAt + 1)) };
}

function hunkComplete(hunk: DiffHunk, oldLine: number, newLine: number): boolean {
    return oldLine - hunk.oldStart >= hunk.oldLines && newLine - hunk.newStart >= hunk.newLines;
}

function newFile(oldPath: string, newPath: string): DiffFile {
    return { path: newPath, oldPath, status: "modified", isBinary: false, hunks: [], additions: 0, deletions: 0 };
}

/**
 * Parses a unified diff as produced by `git diff` or the GitHub diff media type
 * into files and hunks, numbering every line on the old and new side.
 */
export function parseUnifiedDiff(diff: string): DiffFile[] {
    const files: DiffFile[] = [];
    const lines = diff.replace(/\r\n/g, "\n").split("\n");

    let file: DiffFile | null = null;
    let hunk: DiffHunk | null = null;
    let oldLine = 0;
    let newLine = 0;
    let explicitStatus: FileStatus | null = null;

    const finishFile = () => {
        if (file) {
            if (explicitStatus) file.status = explicitStatus;
            files.push(file);
        }
        file = null;
        hunk = null;
        explicitStatus = null;
    };

    for (const line of lines) {
        if (line.startsWith("diff --git ")) {
            finishFile();
            const { oldPath, newPath } = pathsFromGitHeader(line);
            file = newFile(oldPath, newPath);
            continue;
        }

        // Plain unified diffs without a git header start straight at ---. Inside a hunk a removed
        // line can also start with "---", so only treat it as a header once the hunk is complete.
        if (line.startsWith("--- ") && (!file || (hunk && hunkComplete(hunk, oldLine, newLine)))) {
            finishFile();
            file = newFile(stripPrefix(line.slice(4).trim()), stripPrefix(line.slice(4).trim()));
            continue;
        }

        if (!file) continue;
        const current: DiffFile = file;

        if (!hunk) {
            if (line.startsWith("new file mode")) explicitStatus = "added";
            else if (line.startsWith("deleted file mode")) explicitStatus = "deleted";
            else if (line.startsWith("rename from ")) {
                current.oldPath = line.slice("rename from ".length);
                explicitStatus = "renamed";
            } else if (line.startsWith("rename to ")) {
                current.path = line.slice("rename to ".length);
                explicitStatus = "renamed";
            } else if (line.startsWith("Binary files ") || line === "GIT binary patch") current.isBinary = true;
            else if (line.startsWith("--- ")) {
                const path = stripPrefix(line.slice(4).trim());
                if (path === "/dev/null") explicitStatus = "added";
                else current.oldPath = path;
            } else if (line.startsWith("+++ ")) {
                const path = stripPrefix(line.slice(4).trim());
                if (path === "/dev/null") {
                    explicitStatus = "deleted";
                    current.path = current.oldPath;
                } else current.path = path;
            }
        }

        const header = HUNK_HEADER.exec(line);
        if (header) {
            hunk = {
                header: line,
                oldStart: Number(header[1]),
                oldLines: header[2] === undefined ? 1 : Number(header[2]),
                newStart: Number(header[3]),
                newLines: header[4] === undefined ? 1 : Number(header[4]),
                lines: [],
            };
            current.hunks.push(hunk);
            oldLine = hunk.oldStart;
            newLine = hunk.newStart;
            continue;
        }

        if (!hunk) continue;
        const activeHunk: DiffHunk = hunk;

        if (line.startsWith("+")) {
            activeHunk.lines.push({ type: "add", content: line.slice(1), newLine });
            newLine += 1;
            current.additions += 1;
        } else if (line.startsWith("-")) {
            activeHunk.lines.push({ type: "del", content: line.slice(1), oldLine });
            oldLine += 1;
            current.deletions += 1;
        } else if (line.startsWith(" ")) {
            activeHunk.lines.push({ type: "context", content: line.slice(1), oldLine, newLine });
            oldLine += 1;
            newLine += 1;
        } else if (line.startsWith("\\")) {
            // "\ No newline at end of file" carries no content.
            continue;
        } else if (line === "") {
            // A blank line inside a hunk is an empty context line only when the hunk still expects lines.
            const consumedOld = oldLine - activeHunk.oldStart;
            const consumedNew = newLine - activeHunk.newStart;
            if (consumedOld < activeHunk.oldLines || consumedNew < activeHunk.newLines) {
                activeHunk.lines.push({ type: "context", content: "", oldLine, newLine });
                oldLine += 1;
                newLine += 1;
            }
        }
    }
    finishFile();

    return files;
}

export function changedLineCount(file: Pick<DiffFile, "additions" | "deletions">): number {
    return file.additions + file.deletions;
}

/** Maps every new-side line number of a file that appears in the diff to its content. */
export function newSideLines(file: DiffFile): Map<number, string> {
    const map = new Map<number, string>();
    for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
            if (line.newLine !== undefined) map.set(line.newLine, line.content);
        }
    }
    return map;
}
