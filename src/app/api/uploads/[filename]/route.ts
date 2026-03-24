import { NextResponse } from "next/server";

import { readUploadedImage } from "@/lib/upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await context.params;
    const image = await readUploadedImage(filename);
    const extension = filename.split(".").pop()?.toLowerCase();
    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "gif"
          ? "image/gif"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg";

    return new NextResponse(image, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Image not found." }, { status: 404 });
  }
}
