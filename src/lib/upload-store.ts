import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const uploadsDir = path.join(dataDir, "uploads");

export async function saveUploadedImage(file: File | null) {
  if (!file || file.size === 0) {
    return null;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const destination = path.join(uploadsDir, filename);

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(destination, Buffer.from(await file.arrayBuffer()));

  return `/api/uploads/${filename}`;
}

export async function readUploadedImage(filename: string) {
  const filePath = path.join(uploadsDir, path.basename(filename));
  return readFile(filePath);
}
