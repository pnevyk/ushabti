import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// An output target is `{ kind: "path", path }` or `{ kind: "stdout" }`.
export function pathTarget(path) {
    return { kind: "path", path };
}

// Writes one document. For a path target, `path` is the file itself, or the
// containing directory when `name` is given. For stdout, `name` is ignored and
// a trailing newline is ensured so consecutive documents don't run together.
export async function write(target, content, name) {
    if (target.kind === "stdout") {
        const text = content.endsWith("\n") ? content : `${content}\n`;
        await new Promise((resolve, reject) => process.stdout.write(text, (err) => (err ? reject(err) : resolve())));
        return;
    }
    await writeFile(name ? join(target.path, name) : target.path, content, "utf8");
}

// The target for a subdirectory of `target`; stdout stays stdout.
export function subTarget(target, name) {
    return target.kind === "stdout" ? target : pathTarget(join(target.path, name));
}

// Creates the directory a path target points at; nothing to do for stdout.
export function ensureDir(target) {
    return target.kind === "stdout" ? Promise.resolve() : mkdir(target.path, { recursive: true });
}

export function writeBinary(path, buffer) {
    return writeFile(path, buffer);
}
