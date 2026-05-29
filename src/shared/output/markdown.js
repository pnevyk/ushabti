import { NotImplementedError } from "../errors.js";

// Markdown shaping is data-specific; each command implements its layout here.
export function serialize(/* data */) {
    throw new NotImplementedError("markdown serialization");
}
