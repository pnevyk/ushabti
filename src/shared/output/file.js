import { writeFile } from "node:fs/promises";

export function write(path, content) {
    return writeFile(path, content, "utf8");
}
