import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { fetchTickets } from "./service.js";

const FORMATS = ["json", "markdown"];

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            project: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.project) {
        throw new CliError("Missing required --project <key>");
    }

    const format = values.format ?? "json";
    if (!FORMATS.includes(format)) {
        throw new CliError(`Invalid --format: ${format} (expected ${FORMATS.join("|")})`);
    }

    const out = values.out ?? defaultOut(values.project, format);
    const config = loadConfig(values.config);
    await fetchTickets({ project: values.project, format, out, config });
}

function defaultOut(project, format) {
    return format === "markdown" ? `jira-${project}` : `jira-${project}.ushabti.json`;
}
