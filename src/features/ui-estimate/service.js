import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serveUi } from "../../shared/ui.js";

const HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), "assets", "estimate.html");
const HTML = readFileSync(HTML_PATH, "utf8");

export function serve({ openBrowser }) {
    return serveUi(HTML, { openBrowser, label: "estimate" });
}
