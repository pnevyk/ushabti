import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
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
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use --file <markdown>.");
    }

    const config = loadConfig(values.config);
    await updateTicket({ file: values.file, config });
}
