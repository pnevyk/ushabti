import { parseArgs } from "node:util";
import { InvalidCliInputError } from "../../shared/errors.js";
import { readStdinToEof, promptMasked } from "../../shared/prompt.js";
import { SERVICES } from "../../shared/secrets.js";
import { setSecret } from "./service.js";

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
            `A service (${SERVICES.join(" or ")}) is required. Use \`ushabti secrets set <${SERVICES.join("|")}> [--local]\`.`,
        );
    }

    const value = process.stdin.isTTY ? await promptMasked(`Value for ${service}.token: `) : await readStdinToEof();
    if (!value) {
        throw new InvalidCliInputError("A token value is required. Pipe it in, or type it when prompted.");
    }

    const result = setSecret(service, value, { local: values.local ?? false });
    console.log(describeStore(result));
}

function describeStore({ key, scope, storedIn }) {
    const where = storedIn === "keychain" ? "the OS keychain" : "the secrets file (OS keychain unavailable)";
    const scopeLabel = scope === "global" ? "global" : `scoped to ${scope}`;
    return `Stored ${key} in ${where}, ${scopeLabel}.`;
}
