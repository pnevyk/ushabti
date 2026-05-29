import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { CliError } from "./errors.js";

// Candidate paths tried in order when no explicit path is given.
const DEFAULT_PATHS = ["ushabti.config.toml", join(homedir(), ".config", "ushabti", "config.toml")];

export function loadConfig(path) {
    const candidates = path ? [path] : DEFAULT_PATHS;
    for (const candidate of candidates) {
        let raw;
        try {
            raw = readFileSync(candidate, "utf8");
        } catch {
            continue;
        }
        return parse(raw);
    }
    throw new CliError(`Config file not found: ${candidates.join(", ")}`);
}

// Each service validates only the keys it needs, e.g. requireKeys(config, ["jira.baseUrl"]).
export function requireKeys(config, keys) {
    const missing = keys.filter((key) => getPath(config, key) == null || getPath(config, key) === "");
    if (missing.length) {
        throw new CliError(`Missing config keys: ${missing.join(", ")}`);
    }
    return config;
}

function getPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
