import { listSecrets, purgeScope } from "../../shared/secrets.js";

export function listAllSecrets() {
    return listSecrets();
}

export function cleanupScope(path) {
    purgeScope(path);
}
