import { execFileSync } from "node:child_process";

// Local git infrastructure. Throws generic Errors with no knowledge of CLI
// flags; callers add command-specific guidance.

// Pure: extract "owner/name" from a git remote URL. Handles
// git@host:owner/name.git, https://host/owner/name(.git), ssh://git@host/owner/name.git.
export function parseRemoteUrl(url) {
    const match = url.trim().match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) {
        throw new Error(`Unrecognized git remote URL: ${url}`);
    }
    return `${match[1]}/${match[2]}`;
}

export function currentRepo() {
    let url;
    try {
        url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    } catch {
        throw new Error("No git origin remote");
    }
    return parseRemoteUrl(url);
}

export function currentBranch() {
    let branch;
    try {
        branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
        throw new Error("No current git branch");
    }
    if (branch === "HEAD") {
        throw new Error("Detached HEAD, no current git branch");
    }
    return branch;
}
