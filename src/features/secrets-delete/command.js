import { parseArgs } from "node:util";
import { InvalidCliInputError } from "../../shared/errors.js";
import { SERVICES } from "../../shared/secrets.js";
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
        throw new InvalidCliInputError(
            `A service (${SERVICES.join(" or ")}) is required. Use \`ushabti secrets delete <${SERVICES.join("|")}> [--local]\`.`,
        );
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
