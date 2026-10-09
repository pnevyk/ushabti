import { parseArgs } from "node:util";
import { loadConfig } from "../../shared/config.js";
import { InvalidCliInputError } from "../../shared/errors.js";
import { expectPositionals, parseConfluenceRef, pickSubject, resolveSpace } from "../../shared/cli-args.js";
import { createPage } from "./service.js";

const USAGE = "ushabti confluence create <markdown> [<space-key|url>] [--update]";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            space: { type: "string" },
            file: { type: "string" },
            update: { type: "boolean" },
            config: { type: "string" },
        },
    });

    const config = loadConfig(values.config);
    const { file, space } = resolveArgs({ values, positionals, config });
    await createPage({ space, file, update: values.update ?? false, config });
}

export function resolveArgs({ values, positionals, config }) {
    expectPositionals(positionals, 2, USAGE);
    // With the legacy --file flag the lone positional (if any) is the space.
    const [first, second] = values.file != null && positionals.length < 2 ? [undefined, positionals[0]] : positionals;
    const file = pickSubject({ positional: first, flagValue: values.file, flagName: "--file", hint: "Pass the file as an argument: ushabti confluence create page.md." });
    if (!file) {
        throw new InvalidCliInputError("A markdown file is required to read its frontmatter. Use `ushabti confluence create <markdown>`.");
    }
    const space = pickSubject({
        positional: second != null ? spaceKey(second) : undefined,
        flagValue: values.space,
        flagName: "--space",
        hint: "Pass the space key as the second argument (ushabti confluence create page.md ENG), or set `space` under [confluence] in the config.",
    });
    return { file, space: resolveSpace({ explicit: space, config }) };
}

// A bare space key, or a URL under /spaces/<KEY>/.
function spaceKey(value) {
    const ref = parseConfluenceRef(value);
    const space = ref.space ?? ref.value;
    if (!space) {
        throw new InvalidCliInputError(`No Confluence space key was found in ${value}.`);
    }
    return space;
}
