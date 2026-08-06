import { InvalidConfigError } from "../shared/errors.js";
import { mermaidPlugin } from "./mermaid.js";
import { umlPlugin } from "./uml.js";

export const plugins = [mermaidPlugin, umlPlugin];

// Validate [confluence.plugins] eagerly (before any encode call), so a
// misconfigured target or id fails at command start rather than mid-upload.
export function resolveDefaults(config) {
    const raw = config.confluence?.plugins ?? {};
    for (const [target, id] of Object.entries(raw)) {
        if (!plugins.some((p) => p.target === target && p.id === id)) {
            const available = plugins.filter((p) => p.target === target).map((p) => p.id);
            const suggestion = available.length ? `Use one of: ${available.join(", ")}.` : `No plugin supports target "${target}".`;
            throw new InvalidConfigError(`confluence.plugins has target "${target}" set to "${id}", but no such plugin exists. ${suggestion}`);
        }
    }
    return raw;
}
