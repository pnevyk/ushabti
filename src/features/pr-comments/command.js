import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { fetchUnresolvedComments } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            repo: { type: "string" },
            pr: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    const missing = ["repo", "pr", "out"].filter((key) => !values[key]);
    if (missing.length) {
        throw new CliError(`Missing required options: ${missing.map((key) => `--${key}`).join(", ")}`);
    }

    const pr = Number(values.pr);
    if (!Number.isInteger(pr) || pr <= 0) {
        throw new CliError(`Invalid --pr: ${values.pr}`);
    }

    const config = loadConfig(values.config);
    await fetchUnresolvedComments({
        repo: values.repo,
        pr,
        out: values.out,
        config,
    });
}
