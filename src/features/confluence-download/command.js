import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
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
        throw new InvalidCliInputError("A page id is required to download it. Use --id <pageId>.");
    }

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const config = loadConfig(values.config);
    if (values.children) {
        const out = values.out ?? `confluence-${values.id}`;
        await downloadTree({ id: values.id, format, out, config });
    } else {
        await downloadPage({ id: values.id, format, out: values.out, config });
    }
}
