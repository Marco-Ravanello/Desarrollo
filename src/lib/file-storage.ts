import { readFile, writeFile, mkdir } from "fs/promises";
import { basename, join, resolve } from "path";
import { put, get } from "@vercel/blob";

// Los archivos subidos se guardan en Vercel Blob (privado) cuando el proyecto tiene
// BLOB_READ_WRITE_TOKEN. Sin token, por ejemplo en desarrollo local, se usa public/uploads.
// En Vercel el disco es efímero: lo guardado en public/uploads se pierde en cada deploy.
const BLOB_FOLDER = "documentos";
const LOCAL_DIR = resolve(process.cwd(), "public", "uploads");

export const isBlobStorageEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function uploadUrl(storedName: string) {
  return `/api/uploads/${storedName}`;
}

// Nombre seguro y único: sin rutas ni caracteres raros, con marca de tiempo.
export function makeStoredName(originalName: string) {
  const clean = basename(originalName).replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${Date.now()}-${clean}`;
}

export async function saveUploadedFile(storedName: string, data: Buffer, contentType?: string) {
  const name = basename(storedName);
  if (isBlobStorageEnabled()) {
    await put(`${BLOB_FOLDER}/${name}`, data, {
      access: "private",
      contentType: contentType || undefined,
      addRandomSuffix: false,
    });
    return;
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(join(LOCAL_DIR, name), data);
}

// Devuelve el contenido del archivo o null si no existe. Busca primero en Blob y,
// si no está, en public/uploads (archivos cargados antes de activar Blob o en local).
export async function readUploadedFile(storedName: string): Promise<Buffer | null> {
  const name = basename(storedName);
  if (isBlobStorageEnabled()) {
    try {
      const result = await get(`${BLOB_FOLDER}/${name}`, { access: "private" });
      if (result?.stream) {
        return Buffer.from(await new Response(result.stream).arrayBuffer());
      }
    } catch (error) {
      console.error("No se pudo leer el archivo de Vercel Blob:", error);
    }
  }
  try {
    return await readFile(join(LOCAL_DIR, name));
  } catch {
    return null;
  }
}

// Acepta la URL que guarda Document.url ("/api/uploads/<nombre>").
export function storedNameFromUrl(url: string) {
  return basename(decodeURIComponent(url.split("?")[0]));
}
