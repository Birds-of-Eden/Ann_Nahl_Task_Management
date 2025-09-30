// app/api/drive/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOOGLE_API = "https://www.googleapis.com/drive/v3";

// -------- Helper Functions (from both original files) --------

/**
 * Generates a Content-Disposition header value for file downloads,
 * ensuring cross-browser compatibility with non-ASCII filenames.
 */
function contentDisposition(filename: string, fallbackId: string) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_");
  const safe = ascii.length ? ascii : `file-${fallbackId}`;
  const encoded = encodeURIComponent(filename);
  // Provides a simple ASCII filename for old browsers and a UTF-8 encoded one for modern browsers
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

/**
 * Generates a direct-view URL for a Google Drive image file ID.
 * This URL can be used directly in an <img src="..."> tag.
 */
function viewUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// -------- Main GET Handler --------

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const mediaId = searchParams.get("id");
    const filename = searchParams.get("filename") || "";

    const key = process.env.GOOGLE_DRIVE_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Server misconfigured: missing GOOGLE_DRIVE_API_KEY" },
        { status: 500 }
      );
    }

    // --- LOGIC 1: List files in a folder ---
    if (folderId) {
      // 1a) Validate folder metadata
      const metaRes = await fetch(
        `${GOOGLE_API}/files/${folderId}?fields=id,name,mimeType&supportsAllDrives=true&key=${key}`,
        { cache: "no-store" }
      );

      if (!metaRes.ok) {
        return NextResponse.json(
          {
            error:
              "Folder is not public or not found. Make sure link-sharing is 'Anyone with the link: Viewer'.",
          },
          { status: metaRes.status }
        );
      }
      const metadata = await metaRes.json();
      if (metadata.mimeType !== "application/vnd.google-apps.folder") {
        return NextResponse.json(
          { error: "The provided ID is not a Google Drive folder." },
          { status: 400 }
        );
      }

      // 1b) Fetch all image files from the folder with pagination
      const files: any[] = [];
      let pageToken: string | undefined = undefined;
      const fields =
        "nextPageToken,files(id,name,mimeType,webViewLink,thumbnailLink)";

      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
          fields,
          pageSize: "1000",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          key,
        });
        if (pageToken) params.set("pageToken", String(pageToken));

        const listRes = await fetch(`${GOOGLE_API}/files?${params}`, {
          cache: "no-store",
        });
        if (!listRes.ok) {
          throw new Error("Failed to list files from Google Drive.");
        }
        const data = await listRes.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      // 1c) Format the response
      const images = files.map((f) => ({
        id: f.id as string,
        name: f.name as string,
        mimeType: f.mimeType as string,
        webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
        thumbnail: f.thumbnailLink ?? `https://drive.google.com/thumbnail?sz=w400&id=${f.id}`,
        viewUrl: viewUrl(f.id),
      }));

      return NextResponse.json({
        folder: { id: metadata.id, name: metadata.name },
        count: images.length,
        images,
      });
    }

    // --- LOGIC 2: Fetch and stream a single media file ---
    if (mediaId) {
      const upstream = await fetch(
        `${GOOGLE_API}/files/${mediaId}?alt=media&supportsAllDrives=true&key=${key}`,
        { cache: "no-store" }
      );

      if (!upstream.ok) {
        const text = await upstream.text();
        return NextResponse.json(
          { error: "Failed to fetch media", details: text },
          { status: upstream.status }
        );
      }

      const contentType =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      const contentLength = upstream.headers.get("content-length");

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition(filename, mediaId),
      });

      if (contentLength) {
        headers.set("Content-Length", contentLength);
      }

      return new Response(upstream.body, { headers });
    }

    // --- Fallback Error: Missing required parameter ---
    return NextResponse.json(
      { error: "Missing required parameter: 'folderId' or 'id'" },
      { status: 400 }
    );

  } catch (err: any) {
    console.error("DRIVE API ERROR:", err);
    return NextResponse.json(
      { error: "Unexpected server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}