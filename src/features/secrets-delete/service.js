import { deleteSecret } from "../../shared/secrets.js";

export function removeSecret(service, { local = false } = {}) {
    return deleteSecret(service, { local });
}
