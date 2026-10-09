import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parsePageId, pickSubject, resolveOut } from "../../shared/cli-args.js";
import { fetchComments } from "./service.js";

const FORMATS = ["json", "markdown"];

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
    expectPositionals(positionals, 1, "ushabti confluence comments <page-id|url> [--format json|markdown] [--out <path>]");
    const id = pickSubject({
        positional: positionals[0] != null ? parsePageId(positionals[0]) : undefined,
        flagValue: values.id,
        flagName: "--id",
        hint: "Pass the page id or URL as an argument: ushabti confluence comments 12345.",
    });
    if (!id) {
        throw new InvalidCliInputError("A page id is required to fetch its comments. Use `ushabti confluence comments <page-id>` (a page URL works too).");
    }
    return id;
}

function defaultOut(id, format) {
    return format === "markdown" ? `confluence-${id}-comments.md` : `confluence-${id}-comments.ushabti.json`;
}
