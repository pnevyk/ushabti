import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { fetchDigest, isValidDate, resolveMe } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            since: { type: "string" },
            until: { type: "string" },
            repo: { type: "string" },
            author: { type: "string" },
            reviewer: { type: "string" },
            commenter: { type: "string" },
            "comments-by": { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    if (values.since == null) {
        throw new InvalidCliInputError("A start date is required for the digest window. Use --since <date>, e.g. --since 2026-01-01.");
    }
    if (!isValidDate(values.since)) {
        throw new InvalidCliInputError(`${values.since} is not a valid value for --since. Use YYYY-MM-DD or an ISO datetime.`);
    }
    if (values.until != null && !isValidDate(values.until)) {
        throw new InvalidCliInputError(`${values.until} is not a valid value for --until. Use YYYY-MM-DD or an ISO datetime.`);
    }
    if ([values.author, values.reviewer, values.commenter].filter((v) => v != null).length > 1) {
        throw new InvalidCliInputError("--author, --reviewer and --commenter are mutually exclusive.");
    }

    const config = loadConfig(values.config);
    await fetchDigest({
        since: values.since,
        until: values.until ?? null,
        repo: values.repo ?? null,
        author: resolveMe(values.author ?? null, config.github?.username),
        reviewer: resolveMe(values.reviewer ?? null, config.github?.username),
        commenter: resolveMe(values.commenter ?? null, config.github?.username),
        commentsBy: resolveMe(values["comments-by"] ?? null, config.github?.username),
        out: values.out ?? "pr-digest.ushabti.json",
        config,
    });
}
