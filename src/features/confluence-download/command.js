import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parsePageId, pickSubject, resolveOut } from "../../shared/cli-args.js";
import { downloadPage, downloadTree } from "./service.js";

const FORMATS = ["json", "markdown"];

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            id: { type: "string" },
            format: { type: "string" },
            out: { type: "string" },
            children: { type: "boolean" },
            config: { type: "string" },
        },
    });

    const id = resolveId({ values, positionals });

    const format = values.format ?? "markdown";
    if (!FORMATS.includes(format)) {
        throw new InvalidCliInputError(`${format} is not a valid value for --format. Use one of: ${FORMATS.join(", ")}.`);
    }

    const config = loadConfig(values.config);
    if (values.children) {
        const out = resolveOut({ explicit: values.out, defaultPath: `confluence-${id}` });
        await downloadTree({ id, format, out, config });
    } else {
        await downloadPage({ id, format, out: values.out, config });
    }
}

export function resolveId({ values, positionals }) {
    expectPositionals(positionals, 1, "ushabti confluence download <page-id|url> [--format json|markdown] [--out <path>] [--children]");
    const id = pickSubject({
        positional: positionals[0] != null ? parsePageId(positionals[0]) : undefined,
        flagValue: values.id,
        flagName: "--id",
        hint: "Pass the page id or URL as an argument: ushabti confluence download 12345.",
    });
    if (!id) {
        throw new InvalidCliInputError("A page id is required to download it. Use `ushabti confluence download <page-id>` (a page URL works too).");
    }
    return id;
}
