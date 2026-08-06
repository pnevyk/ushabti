import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { fetchComments } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            repo: { type: "string" },
            pr: { type: "string" },
            out: { type: "string" },
            all: { type: "boolean" },
            config: { type: "string" },
        },
    });

    let pr = null;
    if (values.pr != null) {
        pr = Number(values.pr);
        if (!Number.isInteger(pr) || pr <= 0) {
            throw new InvalidCliInputError(`${values.pr} is not a valid value for --pr. Use a positive integer.`);
        }
    }

    const config = loadConfig(values.config);
    await fetchComments({
        repo: values.repo ?? null,
        pr,
        out: values.out ?? "pr-comments.ushabti.json",
        all: values.all ?? false,
        config,
    });
}
