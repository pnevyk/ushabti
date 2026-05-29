import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { createTicket } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            file: { type: "string" },
            config: { type: "string" },
        },
    });

    const config = loadConfig(values.config);
    await createTicket({
        file: values.file,
        config,
    });
}
