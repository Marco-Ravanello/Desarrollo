import { basename } from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readUploadedFile } from "@/lib/file-storage";

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

  try {
    const file = await readUploadedFile(safeFilename);
    if (!file) return new NextResponse("File not found", { status: 404 });

    // Intentar determinar el tipo de contenido basándose en la extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'webp') contentType = 'image/webp';

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new NextResponse("File not found", { status: 404 });
  }
}
