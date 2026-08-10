import { readFile } from "fs/promises";
import { join, basename, resolve } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { filename } = await params;

  // Prevent Path Traversal by extracting only the base name
  const safeFilename = basename(filename);
  const uploadsDir = resolve(process.cwd(), "public", "uploads");
  const path = join(uploadsDir, safeFilename);

  // Additional check to verify the resulting path resides strictly within public/uploads
  if (!path.startsWith(uploadsDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(path);

    // Intentar determinar el tipo de contenido basándose en la extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'webp') contentType = 'image/webp';

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new NextResponse("File not found", { status: 404 });
  }
}
