import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { CliError } from "../../shared/errors.js";
import { filterTickets } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            project: { type: "string" },
            in: { type: "string" },
            where: { type: "string" },
        },
    });

    if (!values.project && !values.in) {
        throw new CliError("Missing required --project <key> or --in <path>");
    }

    const inPath = values.in ?? defaultIn(values.project);
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
    throw new CliError(`No input found: ${json} or ${dir}/ (pass --in <path>)`);
}
