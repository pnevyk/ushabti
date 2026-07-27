// Pure: match a target Media Services file id against a list of Jira
// attachments that already carry their mediaApiFileId. Exported for unit
// testing.
export function matchAttachmentByMediaFileId(attachments, mediaId) {
    return attachments.find((a) => a.mediaApiFileId === mediaId) ?? null;
}

// Impure (I/O): resolve every attachment's Media Services file id -- using
// the inline field when jira.js's runtime response happens to carry it
// despite not typing it on the embedded Attachment interface, otherwise
// falling back to one getAttachment call per attachment that lacks it -- then
// return a resolve(mediaId) closure over the fully-resolved list.
export async function resolveIssueMedia(client, issue) {
    const attachments = issue.fields?.attachment ?? [];
    const resolved = await Promise.all(
        attachments.map(async (a) => ({
            id: a.id,
            filename: a.filename,
            mediaApiFileId: a.mediaApiFileId ?? (await client.issueAttachments.getAttachment({ id: a.id })).mediaApiFileId,
        })),
    );
    return async (mediaId) => {
        const match = matchAttachmentByMediaFileId(resolved, mediaId);
        if (!match) {
            return null;
        }
        return { filename: match.filename, fetchBytes: () => client.issueAttachments.getAttachmentContent({ id: match.id }) };
    };
}
