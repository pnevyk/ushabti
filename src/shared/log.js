import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Writes full error detail -- the invoked command, a timestamp, and the
// stack trace chain (walking `cause`) -- to a per-run file in the system
// temp directory, npm-debug-log style. Returns the file's path.
export function writeErrorLog(err, argv) {
    const path = join(tmpdir(), `ushabti-debug-${timestamp()}.log`);
    writeFileSync(path, formatLog(err, argv));
    return path;
}

function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatLog(err, argv) {
    const lines = [`Command: ushabti ${argv.join(" ")}`, `Time: ${new Date().toISOString()}`, ""];
    let current = err;
    while (current) {
        lines.push(current.stack ?? String(current));
        current = current.cause;
        if (current) {
            lines.push("", "Caused by:");
        }
    }
    return lines.join("\n") + "\n";
}
