import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

/**
 * ImageStore port (PLAN.md §7, M2): local disk in dev, S3-compatible in
 * production. Both implementations share the same contract — normalize through
 * sharp, return a stable public URL.
 */

export interface ImageStore {
  put(buffer: Buffer, contentType?: string): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
}

const MAX_DIMENSION = 1600;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { contentType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { contentType: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50] },
];

function sniffContentType(buffer: Buffer): string | null {
  for (const candidate of SIGNATURES) {
    const length = candidate.bytes.length;
    if (buffer.length < length) continue;
    let matches = true;
    for (let index = 0; index < length; index += 1) {
      if (buffer[index] !== candidate.bytes[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return candidate.contentType;
  }
  return null;
}

/** Normalized output is always WebP, so keys always end in `.webp`. */
function uploadKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.webp`;
}

/**
 * Magic-byte sniff + ≤5 MB guard. Anything else is rejected before sharp sees
 * it. The caller-supplied content type is untrusted and never overrides the
 * sniff — a spoofed `image/jpeg` header with HTML bytes must not pass.
 */
function assertAcceptable(buffer: Buffer, _contentType?: string): string {
  void _contentType;
  if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
    throw new Error("Image size out of bounds");
  }
  const detected = sniffContentType(buffer);
  if (!detected || !ACCEPTED_CONTENT_TYPES.includes(detected as (typeof ACCEPTED_CONTENT_TYPES)[number])) {
    throw new Error("Unsupported image type — JPEG, PNG or WebP only");
  }
  return detected;
}

async function normalizeToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ fit: "inside", height: MAX_DIMENSION, width: MAX_DIMENSION })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Recover the object key (`<yyyy>/<mm>/<uuid>.webp`) from a stored URL or a
 * bare key. Both stores accept either form so listing-edit cleanup never has
 * to know which store wrote the photo.
 */
function keyFromStoredValue(value: string): string {
  const match = value.match(/(\d{4}\/\d{2}\/[^/]+\.webp)$/);
  if (match?.[1]) return match[1];
  return value.replace(/^\/+/, "").replace(/^uploads\//, "");
}

/**
 * Dev image store: writes normalized WebP re-encodes to
 * `public/uploads/<yyyy>/<mm>/<uuid>.webp` and returns the `/uploads/...` URL
 * (no `next/image` remote config needed for local dev).
 */
export class LocalDiskImageStore implements ImageStore {
  async put(buffer: Buffer, contentType?: string): Promise<{ key: string; url: string }> {
    assertAcceptable(buffer, contentType);

    const normalized = await normalizeToWebP(buffer);

    const key = uploadKey();
    const target = join(process.cwd(), "public", "uploads", key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, normalized);

    return { key, url: `/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    const objectKey = keyFromStoredValue(key);
    await unlink(join(process.cwd(), "public", "uploads", objectKey));
  }
}

/**
 * S3-compatible image store (AWS S3 / Cloudflare R2 / MinIO): same normalization,
 * same key layout, public URL composed from `S3_PUBLIC_BASE_URL`.
 */
export class S3ImageStore implements ImageStore {
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            sessionToken: process.env.S3_SESSION_TOKEN,
          }
        : undefined,
  });

  async put(buffer: Buffer, contentType?: string): Promise<{ key: string; url: string }> {
    assertAcceptable(buffer, contentType);
    const normalized = await normalizeToWebP(buffer);
    const key = uploadKey();
    const bucket = process.env.S3_BUCKET ?? "books-exchange";

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: normalized,
        ContentType: "image/webp",
      }),
    );

    const baseUrl = (process.env.S3_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
    return { key, url: `${baseUrl}/${key}` };
  }

  async delete(key: string): Promise<void> {
    const bucket = process.env.S3_BUCKET ?? "books-exchange";
    const objectKey = keyFromStoredValue(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
  }
}

/** Dev default (`local`) | S3-compatible (`s3`). */
export function getImageStore(): ImageStore {
  const kind = process.env.IMAGE_STORE ?? "local";
  if (kind === "s3") return new S3ImageStore();
  return new LocalDiskImageStore();
}
