#!/usr/bin/env node
import { run } from "../src/cli/index.js";
import { CliError } from "../src/shared/errors.js";

try {
    await run(process.argv.slice(2));
} catch (err) {
    if (err instanceof CliError) {
        console.error(err.message);
        process.exit(err.exitCode);
    }
    throw err;
}
