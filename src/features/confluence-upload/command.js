import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, pickSubject } from "../../shared/cli-args.js";
import { uploadPage } from "./service.js";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            file: { type: "string" },
            config: { type: "string" },
        },
    });

    const file = resolveFile({ values, positionals });
    const config = loadConfig(values.config);
    await uploadPage({ file, config });
}

export function resolveFile({ values, positionals }) {
    expectPositionals(positionals, 1, "ushabti confluence upload <markdown>");
    const file = pickSubject({ positional: positionals[0], flagValue: values.file, flagName: "--file", hint: "Pass the file as an argument: ushabti confluence upload 12345.md." });
    if (!file) {
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use `ushabti confluence upload <markdown>`.");
    }
    return file;
}
