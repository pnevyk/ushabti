import { parseArgs } from "node:util";
import { CliError } from "../../shared/errors.js";
import { readStdinToEof, promptMasked } from "../../shared/prompt.js";
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
        throw new CliError("Usage: ushabti secrets set <github|atlassian> [--local]");
    }

    const value = process.stdin.isTTY ? await promptMasked(`Value for ${service}.token: `) : await readStdinToEof();
    if (!value) {
        throw new CliError("No value provided");
    }

    const result = setSecret(service, value, { local: values.local ?? false });
    console.log(describeStore(result));
}

function describeStore({ key, scope, storedIn }) {
    const where = storedIn === "keychain" ? "the OS keychain" : "the secrets file (OS keychain unavailable)";
    const scopeLabel = scope === "global" ? "global" : `scoped to ${scope}`;
    return `Stored ${key} in ${where}, ${scopeLabel}.`;
}
