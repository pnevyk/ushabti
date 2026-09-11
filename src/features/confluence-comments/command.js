import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { fetchComments } from "./service.js";

const FORMATS = ["json", "markdown"];

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.id) {
        throw new InvalidCliInputError("A page id is required to fetch its comments. Use --id <pageId>.");
    }

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const out = values.out ?? defaultOut(values.id, format);
    const config = loadConfig(values.config);
    await fetchComments({ id: values.id, format, out, config });
}

function defaultOut(id, format) {
    return format === "markdown" ? `confluence-${id}-comments.md` : `confluence-${id}-comments.ushabti.json`;
}
