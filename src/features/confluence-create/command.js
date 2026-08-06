import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
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
        throw new InvalidCliInputError("A space key is required to create the page in it. Use --space <key>.");
    }
    if (!values.file) {
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use --file <markdown>.");
    }

    const config = loadConfig(values.config);
    await createPage({
        space: values.space,
        file: values.file,
        update: values.update ?? false,
        config,
    });
}
