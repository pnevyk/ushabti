#!/usr/bin/env node
import { run } from "../src/cli/index.js";
import { UshabtiError, IoError } from "../src/shared/errors.js";
import { writeErrorLog } from "../src/shared/log.js";

try {
    await run(process.argv.slice(2));
} catch (err) {
    if (err instanceof IoError) {
        const logPath = writeErrorLog(err, process.argv.slice(2));
        console.error(`${err.message}\nDetails logged to ${logPath}`);
        process.exit(err.exitCode);
    }
    if (err instanceof UshabtiError) {
        console.error(err.message);
        process.exit(err.exitCode);
    }
    throw err;
}
