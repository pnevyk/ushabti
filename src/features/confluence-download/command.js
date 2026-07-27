import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { downloadPage, downloadTree } from "./service.js";

const FORMATS = ["json", "markdown"];

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            children: { type: "boolean" },
            config: { type: "string" },
        },
    });

    if (!values.id) {
        throw new CliError("Missing required --id <pageId>");
    }

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new CliError(`Invalid --format: ${format} (expected ${FORMATS.join("|")})`);
    }

    const config = loadConfig(values.config);
    if (values.children) {
        const out = values.out ?? `confluence-${values.id}`;
        await downloadTree({ id: values.id, format, out, config });
    } else {
        const out = values.out ?? defaultOut(values.id, format);
        await downloadPage({ id: values.id, format, out, config });
    }
}

function defaultOut(id, format) {
    return format === "markdown" ? `${id}.md` : `confluence-${id}.ushabti.json`;
}
