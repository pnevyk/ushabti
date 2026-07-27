import { CliError } from "../shared/errors.js";
import { mermaidPlugin } from "./mermaid.js";
import { umlPlugin } from "./uml.js";

export const plugins = [mermaidPlugin, umlPlugin];

// Validate [confluence.plugins] eagerly (before any encode call), so a
// misconfigured target or id fails at command start rather than mid-upload.
export function resolveDefaults(config) {
    const raw = config.confluence?.plugins ?? {};
    for (const [target, id] of Object.entries(raw)) {
        if (!plugins.some((p) => p.target === target && p.id === id)) {
            throw new CliError(`Invalid confluence.plugins entry: no plugin "${id}" for target "${target}"`);
        }
    }
    return raw;
}
