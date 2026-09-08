import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Prepares a release locally: bumps package.json, moves the Unreleased
// changelog entries under a new version heading, and creates the release
// commit + tag. Does not push -- that triggers .github/workflows/publish.yml
// (npm publish), so it stays a separate, deliberate step.

const VERSION_ARG_PATTERN = /^(patch|minor|major|\d+\.\d+\.\d+)$/;

export function renderChangelog(content, { oldVersion, newVersion, date, repoUrl }) {
    const unreleasedHeading = "## [Unreleased]";
    const start = content.indexOf(unreleasedHeading);
    if (start === -1) {
        throw new Error("CHANGELOG.md has no ## [Unreleased] section");
    }
    const bodyStart = start + unreleasedHeading.length;
    const nextHeading = content.indexOf("\n## [", bodyStart);
    const bodyEnd = nextHeading === -1 ? content.length : nextHeading;
    const body = content.slice(bodyStart, bodyEnd);
    if (body.trim() === "") {
        throw new Error("Nothing to release: [Unreleased] section is empty");
    }

    const replaced =
        content.slice(0, start) +
        `${unreleasedHeading}\n\n## [${newVersion}] - ${date}` +
        body +
        content.slice(bodyEnd);

    const unreleasedLink = `[Unreleased]: ${repoUrl}/compare/v${oldVersion}...HEAD`;
    const newUnreleasedLink = `[Unreleased]: ${repoUrl}/compare/v${newVersion}...HEAD`;
    const versionLink = `[${newVersion}]: ${repoUrl}/compare/v${oldVersion}...v${newVersion}`;
    if (!replaced.includes(unreleasedLink)) {
        throw new Error(`CHANGELOG.md is missing the expected link line: ${unreleasedLink}`);
    }
    return replaced.replace(unreleasedLink, `${newUnreleasedLink}\n${versionLink}`);
}

function main() {
    const versionArg = process.argv[2];
    if (!versionArg || !VERSION_ARG_PATTERN.test(versionArg)) {
        console.error("Usage: node scripts/prepare-release.js <patch|minor|major|X.Y.Z>");
        process.exit(1);
    }

    if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "") {
        console.warn("Warning: working tree is not clean (only CHANGELOG.md and package.json will be committed)");
    }

    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const oldVersion = pkg.version;
    const repoUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

    const newVersion = execFileSync("npm", ["version", "--no-git-tag-version", versionArg], { encoding: "utf8" })
        .trim()
        .replace(/^v/, "");

    if (execFileSync("git", ["tag", "-l", `v${newVersion}`], { encoding: "utf8" }).trim() !== "") {
        execFileSync("git", ["checkout", "--", "package.json"]);
        console.error(`Tag v${newVersion} already exists`);
        process.exit(1);
    }

    const date = new Date().toISOString().slice(0, 10);
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    writeFileSync("CHANGELOG.md", renderChangelog(changelog, { oldVersion, newVersion, date, repoUrl }));

    execFileSync("git", ["add", "CHANGELOG.md", "package.json"]);
    execFileSync("git", ["commit", "-m", `chore(release): v${newVersion}`]);
    execFileSync("git", ["tag", `v${newVersion}`]);

    console.log(`Release v${newVersion} committed and tagged locally.`);
    console.log(`Push when ready: git push && git push origin v${newVersion}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
