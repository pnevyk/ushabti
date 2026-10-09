import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { expectPositionals, parseJiraRef, pickSubject, resolveProject } from "../../shared/cli-args.js";
import { fetchProject } from "./service.js";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            project: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    const config = loadConfig(values.config);
    const project = resolveProject({ explicit: pickProject({ values, positionals }), config });
    const out = values.out ?? `jira-${project}.ushabti.yaml`;
    await fetchProject({ project, out, config });
}

export function pickProject({ values, positionals }) {
    expectPositionals(positionals, 1, "ushabti jira project [<project-key>] [--out <file>]");
    return pickSubject({
        positional: positionals[0] != null ? parseJiraRef(positionals[0]) : undefined,
        flagValue: values.project,
        flagName: "--project",
        hint: "Pass the project key as an argument (ushabti jira project ABC), or set `project` under [jira] in the config.",
    });
}
