import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, isTicketKey, parseJiraRef, pickSubject, resolveOut, resolveProject, warnDeprecated } from "../../shared/cli-args.js";
import { fetchTickets } from "./service.js";

const FORMATS = ["json", "markdown"];
const USAGE = "ushabti jira fetch [<ticket-id|project-key>] [--format json|markdown] [--out <path>]";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            project: { type: "string" },
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const config = loadConfig(values.config);
    const { project, id } = resolveArgs({ values, positionals, config });
    const out = resolveOut({ explicit: values.out, defaultPath: defaultOut(project, format, id) });
    await fetchTickets({ project, id, format, out, config });
}

// Pure: positional/flags/config -> { project } (whole project) or { id } (one
// ticket; its project is implied by the key).
export function resolveArgs({ values, positionals, config }) {
    expectPositionals(positionals, 1, USAGE);
    const positional = positionals[0] != null ? parseJiraRef(positionals[0]) : undefined;

    const id = values.id != null
        ? pickSubject({ positional, flagValue: values.id, flagName: "--id", hint: "Pass the ticket id as an argument: ushabti jira fetch ABC-123." })
        : positional != null && isTicketKey(positional)
          ? positional
          : undefined;

    if (id) {
        if (values.project != null) {
            warnDeprecated("--project is redundant and ignored: the project is derived from the ticket id.");
        }
        return { id };
    }

    const project = pickSubject({
        positional,
        flagValue: values.project,
        flagName: "--project",
        hint: "Pass the project key as an argument (ushabti jira fetch ABC), or set `project` under [jira] in the config.",
    });
    return { project: resolveProject({ explicit: project, config }) };
}

function defaultOut(project, format, id) {
    if (id) {
        return format === "markdown" ? `${id}.md` : `jira-${id}.ushabti.json`;
    }
    return format === "markdown" ? `jira-${project}` : `jira-${project}.ushabti.json`;
}
