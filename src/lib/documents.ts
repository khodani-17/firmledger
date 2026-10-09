import {
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",

  "image/jpeg",
  "image/png",
  "image/webp",

  "text/plain",

  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function storageRoot() {
  return path.join(
    process.cwd(),
    "private",
    "documents",
  );
}

function sanitiseExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (!extension) {
    return "";
  }

  if (!/^\.[a-z0-9]{1,10}$/.test(extension)) {
    throw new Error("Invalid file extension.");
  }

  return extension;
}

function safeStorageName(
  fileName: string,
) {
  const extension =
    sanitiseExtension(fileName);

  return `${randomUUID()}${extension}`;
}

function firmStorageDirectory(
  firmId: string,
) {
  return path.join(
    storageRoot(),
    firmId,
  );
}

function assertValidFile(
  file: File,
) {
  if (!(file instanceof File)) {
    throw new Error("A valid file is required.");
  }

  if (file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "The uploaded file exceeds the 25 MB limit.",
    );
  }

  if (
    !ALLOWED_MIME_TYPES.has(
      file.type,
    )
  ) {
    throw new Error(
      `File type ${file.type || "unknown"} is not supported.`,
    );
  }

  if (
    !file.name ||
    file.name.length > 255
  ) {
    throw new Error(
      "The file name is invalid.",
    );
  }

  sanitiseExtension(file.name);
}

export async function saveDocumentFile(
  firmId: string,
  file: File,
) {
  assertValidFile(file);

  if (!firmId.trim()) {
    throw new Error("Firm ID is required.");
  }

  const directory =
    firmStorageDirectory(firmId);

  await mkdir(directory, {
    recursive: true,
  });

  const storageName =
    safeStorageName(file.name);

  const storagePath = path.join(
    directory,
    storageName,
  );

  const buffer =
    Buffer.from(
      await file.arrayBuffer(),
    );

  const checksum =
    createHash("sha256")
      .update(buffer)
      .digest("hex");

  await writeFile(
    storagePath,
    buffer,
    {
      flag: "wx",
    },
  );

  return {
    storageName,
    storageKey: path
      .relative(
        storageRoot(),
        storagePath,
      )
      .replaceAll(
        path.sep,
        "/",
      ),
    storageProvider: "LOCAL",
    mimeType: file.type,
    fileSizeBytes: file.size,
    checksum,
  };
}

export async function readDocumentFile(
  storageKey: string,
) {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    path.isAbsolute(storageKey)
  ) {
    throw new Error(
      "Invalid document storage key.",
    );
  }

  const root =
    storageRoot();

  const filePath =
    path.resolve(
      root,
      storageKey,
    );

  const relative =
    path.relative(
      root,
      filePath,
    );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Invalid document storage path.",
    );
  }

  return readFile(filePath);
}

export async function deleteDocumentFile(
  storageKey: string,
) {
  if (
    !storageKey ||
    storageKey.includes("..") ||
    path.isAbsolute(storageKey)
  ) {
    throw new Error(
      "Invalid document storage key.",
    );
  }

  const root =
    storageRoot();

  const filePath =
    path.resolve(
      root,
      storageKey,
    );

  const relative =
    path.relative(
      root,
      filePath,
    );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Invalid document storage path.",
    );
  }

  await unlink(filePath);
}