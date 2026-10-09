import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parseJiraRef, pickSubject, resolveProject } from "../../shared/cli-args.js";
import { filterTickets } from "./service.js";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            project: { type: "string" },
            in: { type: "string" },
            where: { type: "string" },
            config: { type: "string" },
        },
    });

    expectPositionals(positionals, 1, "ushabti jira filter [<project-key>] [--in <path>] [--where <expr>]");
    const explicit = pickSubject({
        positional: positionals[0] != null ? parseJiraRef(positionals[0]) : undefined,
        flagValue: values.project,
        flagName: "--project",
        hint: "Pass the project key as an argument (ushabti jira filter ABC), or set `project` under [jira] in the config.",
    });

    // The project only locates the default input, so it's not needed with --in.
    const inPath = values.in ?? defaultIn(resolveProject({ explicit, config: explicit ? undefined : loadConfig(values.config) }));
    const names = await filterTickets({ inPath, where: values.where });
    for (const name of names) {
        console.log(name);
    }
}

// Default input: the JSON file from `jira fetch`, else its markdown directory.
function defaultIn(project) {
    const json = `jira-${project}.ushabti.json`;
    const dir = `jira-${project}`;
    if (existsSync(json)) return json;
    if (existsSync(dir)) return dir;
    throw new InvalidCliInputError(`No input was found at ${json} or ${dir}/. Use --in <path> to point at one.`);
}
