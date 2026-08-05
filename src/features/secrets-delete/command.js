import { parseArgs } from "node:util";
import { CliError } from "../../shared/errors.js";
import { removeSecret } from "./service.js";

export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            local: { type: "boolean" },
        },
    });

    const service = positionals[0];
    if (!service) {
        throw new CliError("Usage: ushabti secrets delete <github|atlassian> [--local]");
    }

    const { key, removedFromKeychain, removedFromFile } = removeSecret(service, { local: values.local ?? false });
    if (!removedFromKeychain && !removedFromFile) {
        console.log(`${key}: not found.`);
        return;
    }
    const removedFrom = [removedFromKeychain && "the OS keychain", removedFromFile && "the secrets file"]
        .filter(Boolean)
        .join(" and ");
    console.log(`${key}: removed from ${removedFrom}.`);
}
