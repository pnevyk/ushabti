import { existsSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./errors.js";
import { keychainGet, keychainSet, keychainDelete, keychainList } from "./keychain.js";
import {
    LOCAL_SECRETS_PATH,
    GLOBAL_SECRETS_PATH,
    getSecretFromFile,
    setSecretInFile,
    deleteSecretFromFile,
    readSecretFile,
    getScopeId,
    registerScope,
    listScopes,
    unregisterScope,
} from "./secrets-file.js";

const SERVICES = ["github", "atlassian"];

// jira.token predates the [atlassian] table; an inline value there is just as
// deprecated as an inline atlassian.token, so it shares the same warning.
const LEGACY_ALIASES = { "atlassian.token": "jira.token" };

const warnedKeys = new Set();

export function validateService(service) {
    if (!SERVICES.includes(service)) {
        throw new CliError(`Invalid service: ${service} (expected one of: ${SERVICES.join(", ")})`);
    }
}

// Three-tier, scope-aware lookup for one secret key ("github.token" |
// "atlassian.token"): OS keychain (scoped to the nearest registered ancestor
// of cwd, then global) -> dedicated secrets file (local-over-global) ->
// (deprecated) inline in the main config, warning once. Returns undefined
// (never throws) when all tiers miss -- callers decide how to phrase the
// "Missing config keys" error, same as today. `deps` is test-only injection.
export function resolveSecret(config, key, deps = {}) {
    const {
        getScopeId: getScopeIdFn = getScopeId,
        getFromKeychain = keychainGet,
        getFromFile = getSecretFromFile,
    } = deps;

    const scopeId = getScopeIdFn(process.cwd());
    if (scopeId) {
        const scoped = getFromKeychain(key, scopeId);
        if (scoped) {
            return scoped;
        }
    }

    const global = getFromKeychain(key, "global");
    if (global) {
        return global;
    }

    const fromFile = getFromFile(key);
    if (fromFile) {
        return fromFile;
    }

    const inline = legacyInlineValue(config, key);
    if (inline) {
        warnDeprecatedOnce(key);
        return inline;
    }
    return undefined;
}

function legacyInlineValue(config, key) {
    const [section, field] = key.split(".");
    if (config[section]?.[field]) {
        return config[section][field];
    }
    const alias = LEGACY_ALIASES[key];
    if (!alias) {
        return undefined;
    }
    const [aliasSection, aliasField] = alias.split(".");
    return config[aliasSection]?.[aliasField];
}

function warnDeprecatedOnce(key) {
    if (warnedKeys.has(key)) {
        return;
    }
    warnedKeys.add(key);
    const service = key.split(".")[0];
    console.error(
        `Warning: ${key} is set directly in the config file. Run \`ushabti secrets set ${service}\` to store it in your OS keychain instead.`,
    );
}

// Moved from config.js. Same contract/return shape as before: {baseUrl,
// email, token}, throwing CliError naming any still-missing atlassian.*
// field. baseUrl/email aren't secrets and are read directly; token goes
// through resolveSecret.
export function resolveAtlassian(config, deps) {
    const primary = config.atlassian ?? {};
    const legacy = config.jira ?? {};
    const resolved = {
        baseUrl: primary.baseUrl || legacy.baseUrl,
        email: primary.email || legacy.email,
        token: resolveSecret(config, "atlassian.token", deps),
    };
    const missing = Object.entries(resolved)
        .filter(([, value]) => !value)
        .map(([field]) => `atlassian.${field}`);
    if (missing.length) {
        throw new CliError(`Missing config keys: ${missing.join(", ")}`);
    }
    return resolved;
}

// Backs `secrets set`. Tries the OS keychain first at the chosen scope;
// falls back to the corresponding secrets file on any keychain failure.
export function storeSecret(service, value, { local = false } = {}, deps = {}) {
    validateService(service);
    const key = `${service}.token`;
    const { registerScope: registerScopeFn = registerScope, setInKeychain = keychainSet, setInFile = setSecretInFile } = deps;

    const cwd = process.cwd();
    const scope = local ? cwd : "global";
    const scopeId = local ? registerScopeFn(cwd) : "global";

    if (setInKeychain(key, value, scopeId)) {
        return { key, scope, storedIn: "keychain" };
    }
    setInFile(key, value, local ? LOCAL_SECRETS_PATH : GLOBAL_SECRETS_PATH);
    return { key, scope, storedIn: "file" };
}

// Backs `secrets delete`. Best-effort removal from both the keychain and the
// secrets file at the chosen scope -- neither missing is an error.
export function deleteSecret(service, { local = false } = {}, deps = {}) {
    validateService(service);
    const key = `${service}.token`;
    const {
        getScopeId: getScopeIdFn = getScopeId,
        deleteFromKeychain = keychainDelete,
        deleteFromFile = deleteSecretFromFile,
    } = deps;

    const cwd = process.cwd();
    const scope = local ? cwd : "global";
    const scopeId = local ? getScopeIdFn(cwd) : "global";

    const removedFromKeychain = scopeId ? deleteFromKeychain(key, scopeId) : false;
    const removedFromFile = deleteFromFile(key, local ? LOCAL_SECRETS_PATH : GLOBAL_SECRETS_PATH);
    return { key, scope, removedFromKeychain, removedFromFile };
}

// Backs `secrets list`. Reports ground truth from the keychain (not just
// what the scope registry claims) plus the global/registered-scope secrets
// files, and flags registered scopes whose directory no longer exists.
export function listSecrets(deps = {}) {
    const {
        listFromKeychain = keychainList,
        listScopes: listScopesFn = listScopes,
        readFileAt = readSecretFile,
        exists = existsSync,
    } = deps;

    const scopes = listScopesFn();
    const idToPath = new Map(scopes.map(({ path, id }) => [id, path]));
    const seen = new Set();
    const entries = [];

    const addEntry = (service, scope) => {
        const dedupeKey = `${service}:${scope}`;
        if (seen.has(dedupeKey)) {
            return;
        }
        seen.add(dedupeKey);
        entries.push({ service, scope });
    };

    for (const { scope, key } of listFromKeychain()) {
        const service = serviceFromKey(key);
        if (!service) {
            continue;
        }
        if (scope === "global") {
            addEntry(service, "global");
        } else if (idToPath.has(scope)) {
            addEntry(service, idToPath.get(scope));
        }
    }

    const globalFile = readFileAt(GLOBAL_SECRETS_PATH);
    for (const service of SERVICES) {
        if (globalFile[service]?.token) {
            addEntry(service, "global");
        }
    }

    for (const { path } of scopes) {
        const scopedFile = readFileAt(join(path, LOCAL_SECRETS_PATH));
        for (const service of SERVICES) {
            if (scopedFile[service]?.token) {
                addEntry(service, path);
            }
        }
    }

    const brokenScopes = scopes.filter(({ path }) => !exists(path)).map(({ path }) => path);

    return { entries, brokenScopes };
}

function serviceFromKey(key) {
    return SERVICES.find((service) => key === `${service}.token`) ?? null;
}

// Best-effort purge of both services' secrets at a registered scope (keychain
// + that directory's local secrets file), then drops the registry entry.
// Used by `secrets list`'s broken-scope cleanup.
export function purgeScope(path, deps = {}) {
    const {
        getScopeId: getScopeIdFn = getScopeId,
        deleteFromKeychain = keychainDelete,
        deleteFromFile = deleteSecretFromFile,
        unregisterScope: unregisterScopeFn = unregisterScope,
    } = deps;

    const scopeId = getScopeIdFn(path);
    for (const service of SERVICES) {
        const key = `${service}.token`;
        if (scopeId) {
            deleteFromKeychain(key, scopeId);
        }
        deleteFromFile(key, join(path, LOCAL_SECRETS_PATH));
    }
    unregisterScopeFn(path);
}
