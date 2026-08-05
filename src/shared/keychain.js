import { Entry, findCredentials } from "@napi-rs/keyring";

const SERVICE = "ushabti";

// Pure: the account name an entry is stored/looked up under. `scope` is
// "global" or a scope id from secrets-file.js's registry -- never a raw
// directory path (some keychain backends limit identifier length).
export function accountName(key, scope) {
    return `${scope}:${key}`;
}

// Any failure -- no entry, no keychain backend available (e.g. a headless
// Linux box with no Secret Service daemon running), unsupported platform --
// is treated as "not present," never a hard error, so callers fall through
// to the next resolution tier.
export function keychainGet(key, scope) {
    try {
        return new Entry(SERVICE, accountName(key, scope)).getPassword() || null;
    } catch {
        return null;
    }
}

export function keychainSet(key, value, scope) {
    try {
        new Entry(SERVICE, accountName(key, scope)).setPassword(value);
        return true;
    } catch {
        return false;
    }
}

export function keychainDelete(key, scope) {
    try {
        return !!new Entry(SERVICE, accountName(key, scope)).deleteCredential();
    } catch {
        return false;
    }
}

// All ushabti entries currently in the keychain, parsed back into
// {key, scope}. Used by `secrets list` to report ground truth instead of
// just trusting the scope registry. Unsupported backends/failures yield [].
export function keychainList() {
    try {
        return findCredentials(SERVICE)
            .map(({ account }) => parseAccountName(account))
            .filter(Boolean);
    } catch {
        return [];
    }
}

function parseAccountName(account) {
    const separator = account.indexOf(":");
    if (separator === -1) {
        return null;
    }
    return { scope: account.slice(0, separator), key: account.slice(separator + 1) };
}
