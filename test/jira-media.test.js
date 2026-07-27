import { test } from "node:test";
import assert from "node:assert/strict";
import { matchAttachmentByMediaFileId } from "../src/shared/jira-media.js";

const attachments = [
    { id: "1", filename: "one.png", mediaApiFileId: "media-1" },
    { id: "2", filename: "two.png", mediaApiFileId: "media-2" },
];

test("matchAttachmentByMediaFileId finds the attachment with the matching id", () => {
    assert.deepEqual(matchAttachmentByMediaFileId(attachments, "media-2"), attachments[1]);
});

test("matchAttachmentByMediaFileId returns null when no attachment matches", () => {
    assert.equal(matchAttachmentByMediaFileId(attachments, "media-404"), null);
});

test("matchAttachmentByMediaFileId returns null for an empty list", () => {
    assert.equal(matchAttachmentByMediaFileId([], "media-1"), null);
});
