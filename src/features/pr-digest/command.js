import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { fetchDigest, isValidDate } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            since: { type: "string" },
            until: { type: "string" },
            repo: { type: "string" },
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

    const config = loadConfig(values.config);
    await fetchDigest({
        since: values.since,
        until: values.until ?? null,
        repo: values.repo ?? null,
        out: values.out ?? "pr-digest.ushabti.json",
        config,
    });
}
