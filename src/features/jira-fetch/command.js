import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { fetchTickets } from "./service.js";

const FORMATS = ["json", "markdown"];

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            project: { type: "string" },
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.id && !values.project) {
        throw new InvalidCliInputError("A project key (or a specific ticket id) is required to fetch tickets. Use --project <key> or --id <ticket-id>.");
    }

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const out = values.out ?? defaultOut(values.project, format, values.id);
    const config = loadConfig(values.config);
    await fetchTickets({ project: values.project, id: values.id, format, out, config });
}

function defaultOut(project, format, id) {
    if (id) {
        return format === "markdown" ? `${id}.md` : `jira-${id}.ushabti.json`;
    }
    return format === "markdown" ? `jira-${project}` : `jira-${project}.ushabti.json`;
}
