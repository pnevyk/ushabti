import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
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
        throw new InvalidCliInputError("A project key is required to look up its people and boards. Use --project <key>, e.g. --project ABC.");
    }

    const out = values.out ?? `jira-${values.project}.ushabti.yaml`;
    const config = loadConfig(values.config);
    await fetchProject({ project: values.project, out, config });
}
