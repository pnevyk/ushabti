import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
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
        throw new CliError("Missing required --since <date>");
    }
    if (!isValidDate(values.since)) {
        throw new CliError(`Invalid --since: ${values.since} (expected YYYY-MM-DD or ISO datetime)`);
    }
    if (values.until != null && !isValidDate(values.until)) {
        throw new CliError(`Invalid --until: ${values.until} (expected YYYY-MM-DD or ISO datetime)`);
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
