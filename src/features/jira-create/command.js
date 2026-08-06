import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { createTicket } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            file: { type: "string" },
            project: { type: "string" },
            update: { type: "boolean" },
            config: { type: "string" },
        },
    });

    if (!values.file) {
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use --file <markdown>.");
    }
    if (!values.project) {
        throw new InvalidCliInputError("A project key is required to create the ticket in it. Use --project <key>, e.g. --project ABC.");
    }

    const config = loadConfig(values.config);
    await createTicket({
        file: values.file,
        project: values.project,
        update: values.update ?? false,
        config,
    });
}
