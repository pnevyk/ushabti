import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { CliError } from "./errors.js";

const LOCAL_PATH = "ushabti.config.toml";
const GLOBAL_PATH = join(homedir(), ".config", "ushabti", "config.toml");

// An explicit --config path is used exclusively (no merging). Otherwise,
// local and global are merged when both exist, local winning key-by-key, so
// a project-local file only needs to state what it overrides -- either may
// be absent, but at least one must exist.
export function loadConfig(path) {
    const config = tryLoadMerged(path);
    if (!config) {
        throw new CliError(`Config file not found: ${path ?? `${LOCAL_PATH}, ${GLOBAL_PATH}`}`);
    }
    return config;
}

// Like loadConfig, but returns {} instead of throwing when no config file
// exists at all -- for commands with no required credentials (e.g. `ui`
// commands), which shouldn't hard-fail just because no config was set up.
// An explicit --config path that doesn't exist still throws either way.
export function loadOptionalConfig(path) {
    if (path) {
        return loadConfig(path);
    }
    return tryLoadMerged(path) ?? {};
}

function tryLoadMerged(path) {
    if (path) {
        return tryParse(path);
    }
    const local = tryParse(LOCAL_PATH);
    const global = tryParse(GLOBAL_PATH);
    if (!local && !global) {
        return null;
    }
    return mergeConfig(global ?? {}, local ?? {});
}

function tryParse(path) {
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    } catch {
        return null;
    }
    return parse(raw);
}

// Pure: deep-merge two parsed config objects, `override` taking precedence
// key-by-key over `base` (recursing into nested tables like
// [confluence.plugins]) -- so a project-local file only needs to specify the
// fields it wants to change, not repeat everything from the global file.
// Exported for unit testing.
export function mergeConfig(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        result[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeConfig(base[key], value) : value;
    }
    return result;
}

function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
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
