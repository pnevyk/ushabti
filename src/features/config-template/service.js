import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The example config shipped alongside the package is the single source of
// truth for this template, so it can't drift from what ushabti.config.example.toml
// actually documents.
const EXAMPLE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "ushabti.config.example.toml");

export function configTemplate() {
    return readFileSync(EXAMPLE_PATH, "utf8");
}
