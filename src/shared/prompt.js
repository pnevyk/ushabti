import { createInterface } from "node:readline/promises";

const CTRL_C = 0x03;
const BACKSPACE = 0x08;
const DELETE = 0x7f;

// Reads all of `stream` to EOF (the piped-input case for `secrets set`),
// trimming exactly one trailing newline.
export async function readStdinToEof(stream = process.stdin) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

// Interactive prompt with nothing echoed back (like sudo/ssh -i), so there's
// no on-screen state that could desync from the typed/pasted value. Falls
// back to a plain (visible) prompt if stdin isn't a TTY or raw mode isn't
// actually available -- never throws just because hiding input isn't
// possible. Doesn't support arrow-key editing, which is fine for pasting a
// token.
export async function promptMasked(label) {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
        return promptPlain(label);
    }
    try {
        return await promptRawMasked(label);
    } catch {
        return promptPlain(label);
    }
}

// Plain yes/no prompt; answers false when not a TTY, since there's no one to
// ask -- used by `secrets list`'s broken-scope cleanup, which must stay safe
// to run non-interactively.
export async function promptConfirm(label) {
    if (!process.stdin.isTTY) {
        return false;
    }
    const answer = await promptPlain(label);
    return /^y(es)?$/i.test(answer.trim());
}

function promptPlain(label) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return rl.question(label).finally(() => rl.close());
}

function promptRawMasked(label) {
    return new Promise((resolve, reject) => {
        process.stdout.write(label);
        let value = "";

        const cleanup = () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener("data", onData);
            process.stdin.removeListener("error", onError);
        };
        const onError = (err) => {
            cleanup();
            reject(err);
        };
        // Iterates per code point, not per chunk -- a paste arrives as one
        // chunk containing the whole string, and treating it as a single
        // unit would misdetect it as one "character". Nothing is echoed, so
        // there's no on-screen count to keep in sync with `value.length`.
        const onData = (chunk) => {
            for (const char of chunk.toString("utf8")) {
                const code = char.codePointAt(0);
                if (code === CTRL_C) {
                    cleanup();
                    process.stdout.write("\n");
                    process.exit(130);
                    return;
                }
                if (char === "\r" || char === "\n") {
                    cleanup();
                    process.stdout.write("\n");
                    resolve(value);
                    return;
                }
                if (code === BACKSPACE || code === DELETE) {
                    value = value.slice(0, -1);
                } else if (code >= 0x20) {
                    value += char;
                }
            }
        };

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", onData);
        process.stdin.on("error", onError);
    });
}
