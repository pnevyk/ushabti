import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parseJiraRef, pickSubject, resolveOut } from "../../shared/cli-args.js";
import { fetchComments } from "./service.js";

const FORMATS = ["json", "markdown"];
const USAGE = "ushabti jira comments <ticket-id> [--format json|markdown] [--out <path>]";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    const id = resolveId({ values, positionals });

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const out = resolveOut({ explicit: values.out, defaultPath: defaultOut(id, format) });
    const config = loadConfig(values.config);
    await fetchComments({ id, format, out, config });
}

export function resolveId({ values, positionals }) {
    expectPositionals(positionals, 1, USAGE);
    const id = pickSubject({
        positional: positionals[0] != null ? parseJiraRef(positionals[0]) : undefined,
        flagValue: values.id,
        flagName: "--id",
        hint: "Pass the ticket id as an argument: ushabti jira comments ABC-123.",
    });
    if (!id) {
        throw new InvalidCliInputError("A ticket key is required to fetch its comments. Use `ushabti jira comments <ticket-id>`, e.g. ABC-123.");
    }
    return id;
}

function defaultOut(id, format) {
    return format === "markdown" ? `${id}-comments.md` : `jira-${id}-comments.ushabti.json`;
}
