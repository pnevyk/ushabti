import { storeSecret } from "../../shared/secrets.js";

export function setSecret(service, value, { local = false } = {}) {
    return storeSecret(service, value, { local });
}
