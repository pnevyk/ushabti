import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { fetchTickets } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            project: { type: "string" },
            out: { type: "string" },
            config: { type: "string" },
        },
    });

    const config = loadConfig(values.config);
    await fetchTickets({
        project: values.project,
        out: values.out,
        config,
    });
}
