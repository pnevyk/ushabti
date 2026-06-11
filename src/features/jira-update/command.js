import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { updateTicket } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            file: { type: "string" },
            config: { type: "string" },
        },
    });

    if (!values.file) {
        throw new CliError("Missing required --file <markdown>");
    }

    const config = loadConfig(values.config);
    await updateTicket({ file: values.file, config });
}
