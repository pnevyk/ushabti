import { parseArgs } from "node:util";
import { loadOptionalConfig } from "../../shared/config.js";
import { resolveOpenBrowser } from "../../shared/ui.js";
import { serve } from "./service.js";

export async function run(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            browser: { type: "boolean" },
            "no-browser": { type: "boolean" },
            config: { type: "string" },
        },
    });

    const config = loadOptionalConfig(values.config);
    const openBrowser = resolveOpenBrowser(config, { browser: values.browser, noBrowser: values["no-browser"] });
    serve({ openBrowser });
}
