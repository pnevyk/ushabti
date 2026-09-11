import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "./errors.js";
import { toConfluenceError } from "./confluence-errors.js";
import { networkErrorCode } from "./error-signals.js";

// _links.next is a full URL (relative or absolute); only its `cursor` query
// param is meaningful to the next call. Shared by every Confluence v2
// endpoint that paginates this way (descendants, attachments, comments).
export function nextCursor(links) {
    const next = links?.next;
    if (!next) {
        return null;
    }
    return new URL(next, "https://placeholder.invalid").searchParams.get("cursor");
}

// Pure: match a target Media Services file id against a page's attachment
// list. Exported for unit testing.
export function matchAttachmentByFileId(attachments, mediaId) {
    return attachments.find((a) => a.fileId === mediaId) ?? null;
}

// Impure (I/O): fetch all of a page's attachments (paginated via nextCursor),
// then return a resolve(mediaId) closure that matches against them and
// downloads bytes via a raw authenticated fetch -- confluence.js has no typed
// byte-download method for full attachment content, only a thumbnail one
// (getAttachmentThumbnailById, the wrong thing).
export async function resolvePageMedia(client, pageId, credentials) {
    const attachments = [];
    let cursor;
    do {
        let page;
        try {
            page = await client.attachment.getPageAttachments({ id: pageId, cursor });
        } catch (err) {
            throw toConfluenceError(err, { resource: `page ${pageId}` });
        }
        attachments.push(...(page.results ?? []));
        cursor = nextCursor(page._links);
    } while (cursor);

    return async (mediaId) => {
        const match = matchAttachmentByFileId(attachments, mediaId);
        if (!match) {
            return null;
        }
        return { filename: match.title, fetchBytes: () => fetchAttachmentBytes(match.downloadLink, credentials) };
    };
}

// Raw fetch against the attachment's downloadLink, using the same Basic auth
// as the JSON API. downloadLink is relative to the site's "/wiki" path (the
// Confluence web app root), not to `baseUrl` itself -- `baseUrl` is the bare
// site URL confluence.js's own client config expects (no "/wiki"), confirmed
// live: the v2 API's returned downloadLink 404s without this prefix and
// resolves correctly with it.
export async function fetchAttachmentBytes(downloadLink, { baseUrl, email, token }) {
    const url = new URL(`/wiki${downloadLink}`, baseUrl);
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    let response;
    try {
        response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    } catch (err) {
        const code = networkErrorCode(err);
        throw code
            ? new ConnectionError({ service: "confluence", cause: err, code })
            : new UnexpectedIoError({ service: "confluence", cause: err });
    }
    if (!response.ok) {
        const cause = new Error(`${response.status} ${response.statusText}`);
        if (response.status === 401) throw new AuthenticationError({ service: "confluence", cause });
        if (response.status === 403) throw new PermissionError({ service: "confluence", cause, resource: downloadLink });
        if (response.status === 404) throw new NotFoundError({ service: "confluence", cause, resource: downloadLink });
        if (response.status === 429) throw new RateLimitedError({ service: "confluence", cause });
        if (response.status >= 500) throw new ServiceUnavailableError({ service: "confluence", cause });
        throw new UnexpectedIoError({ service: "confluence", cause });
    }
    return Buffer.from(await response.arrayBuffer());
}
