import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";
import { mergeConfig } from "./config.js";

export const LOCAL_SECRETS_PATH = "ushabti.secrets.toml";
export const GLOBAL_SECRETS_PATH = join(homedir(), ".config", "ushabti", "secrets.toml");

function tryParseFile(path) {
    try {
        return parse(readFileSync(path, "utf8"));
    } catch {
        return null;
    }
}

function writeFile(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stringify(content), "utf8");
}

// Parsed content of a single secrets file, {} if missing/unreadable. Exported
// for reading a specific registered scope's file directly (see secrets.js's
// listSecrets), not just the fixed local/global paths.
export function readSecretFile(path) {
    return tryParseFile(path) ?? {};
}

// Merged (local-over-global) secrets file content, {} if neither exists.
export function loadSecretsFile() {
    return mergeConfig(readSecretFile(GLOBAL_SECRETS_PATH), readSecretFile(LOCAL_SECRETS_PATH));
}

export function getSecretFromFile(key) {
    const [section, field] = key.split(".");
    return loadSecretsFile()[section]?.[field];
}

// Preserves any other keys already in the file at `path`.
export function setSecretInFile(key, value, path) {
    const [section, field] = key.split(".");
    const current = tryParseFile(path) ?? {};
    current[section] = { ...(current[section] ?? {}), [field]: value };
    writeFile(path, current);
}

export function deleteSecretFromFile(key, path) {
    const [section, field] = key.split(".");
    const current = tryParseFile(path);
    if (current?.[section]?.[field] === undefined) {
        return false;
    }
    delete current[section][field];
    writeFile(path, current);
    return true;
}

// Scope registry: directory path -> opaque keychain scope id, kept in the
// GLOBAL secrets file's [scopes] table only (there is exactly one registry,
// not a local/global pair). A raw path isn't a great keychain account name
// (length limits on some backends), and indirecting through an id lets
// resolution walk up from cwd to find the nearest registered ancestor.
// Every registry function takes an optional `registryPath`, defaulting to
// the real global file, so tests can point it at a tmpdir instead.
function loadRegistry(registryPath) {
    return tryParseFile(registryPath)?.scopes ?? {};
}

function saveRegistry(scopes, registryPath) {
    const current = tryParseFile(registryPath) ?? {};
    writeFile(registryPath, { ...current, scopes });
}

// Walks from `cwd` up through parent directories, returning the id of the
// first registered exact match, or null once the filesystem root is reached
// with no match.
export function getScopeId(cwd, registryPath = GLOBAL_SECRETS_PATH) {
    const registry = loadRegistry(registryPath);
    let dir = cwd;
    for (;;) {
        if (registry[dir]) {
            return registry[dir];
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

// Get-or-create: always keyed on the literal `cwd` passed in (no ancestor
// reuse on write -- registering from a subdirectory creates its own scope).
export function registerScope(cwd, registryPath = GLOBAL_SECRETS_PATH) {
    const registry = loadRegistry(registryPath);
    if (registry[cwd]) {
        return registry[cwd];
    }
    const id = randomUUID();
    saveRegistry({ ...registry, [cwd]: id }, registryPath);
    return id;
}

export function listScopes(registryPath = GLOBAL_SECRETS_PATH) {
    return Object.entries(loadRegistry(registryPath)).map(([path, id]) => ({ path, id }));
}

export function unregisterScope(path, registryPath = GLOBAL_SECRETS_PATH) {
    const registry = loadRegistry(registryPath);
    if (!registry[path]) {
        return false;
    }
    const { [path]: _removed, ...rest } = registry;
    saveRegistry(rest, registryPath);
    return true;
}
