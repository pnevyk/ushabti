import { writeFile, mkdir } from "node:fs/promises";

export function write(path, content) {
    return writeFile(path, content, "utf8");
}

export function ensureDir(path) {
    return mkdir(path, { recursive: true });
}
