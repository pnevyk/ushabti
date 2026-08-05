import { promptConfirm } from "../../shared/prompt.js";
import { listAllSecrets, cleanupScope } from "./service.js";

export async function run() {
    const { entries, brokenScopes } = listAllSecrets();

    if (!entries.length) {
        console.log("No secrets stored.");
    } else {
        for (const { service, scope } of entries) {
            const broken = brokenScopes.includes(scope);
            console.log(`${service}: ${scope}${broken ? " (directory no longer exists)" : ""}`);
        }
    }

    if (!brokenScopes.length) {
        return;
    }

    if (!process.stdin.isTTY) {
        console.log("Run interactively (ushabti secrets list) to clean up broken scopes.");
        return;
    }

    for (const path of brokenScopes) {
        const confirmed = await promptConfirm(`Delete secrets and registry entry for ${path}? [y/N] `);
        if (confirmed) {
            cleanupScope(path);
            console.log(`Removed scope ${path}.`);
        }
    }
}
