import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parsePrRef, pickSubject } from "../../shared/cli-args.js";
import { fetchComments } from "./service.js";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            repo: { type: "string" },
            pr: { type: "string" },
            out: { type: "string" },
            all: { type: "boolean" },
            config: { type: "string" },
        },
    });

    const { repo, pr } = resolveArgs({ values, positionals });
    const config = loadConfig(values.config);
    await fetchComments({
        repo,
        pr,
        out: values.out ?? "pr-comments.ushabti.json",
        all: values.all ?? false,
        config,
    });
}

// Pure: positional (number or PR URL) / --pr / --repo -> { repo, pr }; both
// null when unspecified (resolved later from git and the current branch).
export function resolveArgs({ values, positionals }) {
    expectPositionals(positionals, 1, "ushabti pr comments [<pr-number|url>] [--repo <owner/name>] [--out <file>] [--all]");
    const ref = positionals[0] != null ? parsePrRef(positionals[0]) : {};
    const raw = pickSubject({ positional: ref.pr, flagValue: values.pr, flagName: "--pr", hint: "Pass the PR number or URL as an argument: ushabti pr comments 42." });

    let pr = null;
    if (raw != null) {
        pr = Number(raw);
        if (!Number.isInteger(pr) || pr <= 0) {
            throw new InvalidCliInputError(`${raw} is not a valid pull request number. Use a positive integer or a PR URL.`);
        }
    }
    if (ref.repo && values.repo && ref.repo !== values.repo) {
        throw new InvalidCliInputError(`--repo (${values.repo}) conflicts with the repository in the PR URL (${ref.repo}).`);
    }
    return { repo: values.repo ?? ref.repo ?? null, pr };
}
