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

    let pr = null;
    if (values.pr != null) {
        pr = Number(values.pr);
        if (!Number.isInteger(pr) || pr <= 0) {
            throw new CliError(`Invalid --pr: ${values.pr}`);
        }
    }

    const config = loadConfig(values.config);
    await fetchUnresolvedComments({
        repo: values.repo ?? null,
        pr,
        out: values.out ?? "pr-comments.ushabti.json",
        config,
    });
}
