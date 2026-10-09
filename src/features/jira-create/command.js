import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parseJiraRef, pickSubject, resolveProject } from "../../shared/cli-args.js";
import { createTicket } from "./service.js";

const USAGE = "ushabti jira create <markdown> [<project-key>] [--update]";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            file: { type: "string" },
            project: { type: "string" },
            update: { type: "boolean" },
            config: { type: "string" },
        },
    });

    const config = loadConfig(values.config);
    const { file, project } = resolveArgs({ values, positionals, config });
    await createTicket({ file, project, update: values.update ?? false, config });
}

export function resolveArgs({ values, positionals, config }) {
    expectPositionals(positionals, 2, USAGE);
    // With the legacy --file flag the lone positional (if any) is the project.
    const [first, second] = values.file != null && positionals.length < 2 ? [undefined, positionals[0]] : positionals;
    const file = pickSubject({ positional: first, flagValue: values.file, flagName: "--file", hint: "Pass the file as an argument: ushabti jira create ticket.md." });
    if (!file) {
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use `ushabti jira create <markdown>`.");
    }
    const project = pickSubject({
        positional: second != null ? parseJiraRef(second) : undefined,
        flagValue: values.project,
        flagName: "--project",
        hint: "Pass the project key as the second argument (ushabti jira create ticket.md ABC), or set `project` under [jira] in the config.",
    });
    return { file, project: resolveProject({ explicit: project, config }) };
}
