import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
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

    const config = loadConfig(values.config);
    await fetchUnresolvedComments({
        repo: values.repo,
        pr: Number(values.pr),
        out: values.out,
        config,
    });
}
