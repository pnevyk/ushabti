import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { fetchProject } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            project: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.project) {
        throw new CliError("Missing required --project <key>");
    }

    const out = values.out ?? `jira-${values.project}.ushabti.yaml`;
    const config = loadConfig(values.config);
    await fetchProject({ project: values.project, out, config });
}
