import { createV2Client } from "confluence.js";
import { resolveAtlassian } from "./secrets.js";

export function createConfluenceClient(config) {
    const { baseUrl, email, token } = resolveAtlassian(config);
    return createV2Client({ host: baseUrl, auth: { type: "basic", email, apiToken: token } });
}
