import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { CliError } from "./errors.js";

// Starts a local HTTP server serving a single static HTML string at "/",
// used by every `ui <tool>` command. Runs until the process is killed
// (e.g. Ctrl+C) -- there is no separate shutdown path.
export function serveUi(html, { openBrowser, label }) {
    const server = createServer((req, res) => {
        if (req.method === "GET" && req.url === "/") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        const url = `http://127.0.0.1:${port}`;
        console.log(`Serving ui ${label} at ${url}`);
        console.log("Press Ctrl+C to stop.");
        if (openBrowser) {
            const [cmd, args] = openerCommand(process.platform, url);
            spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
        }
    });

    return server;
}

// Pure: the OS-specific command to open a URL in the default browser.
// Exported for unit testing.
export function openerCommand(platform, url) {
    if (platform === "darwin") {
        return ["open", [url]];
    }
    if (platform === "win32") {
        return ["cmd", ["/c", "start", "", url]];
    }
    return ["xdg-open", [url]];
}

// Pure: resolve whether a `ui` command should open a browser, from its
// --browser/--no-browser flags and the shared [ui] config. Exported for
// unit testing.
export function resolveOpenBrowser(config, { browser, noBrowser }) {
    if (browser && noBrowser) {
        throw new CliError("--browser and --no-browser are mutually exclusive");
    }
    if (noBrowser) {
        return false;
    }
    return browser ?? config.ui?.openBrowser ?? false;
}
