import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createTicket } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            file: { type: "string" },
            project: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.file) {
        throw new CliError("Missing required --file <markdown>");
    }
    if (!values.project) {
        throw new CliError("Missing required --project <key>");
    }

    const config = loadConfig(values.config);
    await createTicket({ file: values.file, project: values.project, config });
}
