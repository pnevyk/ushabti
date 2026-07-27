import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createPage } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            space: { type: "string" },
            file: { type: "string" },
            update: { type: "boolean" },
            config: { type: "string" },
        },
    });

    if (!values.space) {
        throw new CliError("Missing required --space <key>");
    }
    if (!values.file) {
        throw new CliError("Missing required --file <markdown>");
    }

    const config = loadConfig(values.config);
    await createPage({
        space: values.space,
        file: values.file,
        update: values.update ?? false,
        config,
    });
}
