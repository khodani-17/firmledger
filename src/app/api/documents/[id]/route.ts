import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { readDocumentFile } from "@/lib/documents";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function safeDownloadName(fileName: string) {
  return fileName
    .replace(/[\r\n]/g, "")
    .replace(/["\\]/g, "")
    .trim() || "document";
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const user = await getCurrentUser();

  if (!user || !user.active) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const { id } = await context.params;

  if (!id || id.length > 100) {
    return NextResponse.json(
      {
        error: "Invalid document ID.",
      },
      {
        status: 400,
      },
    );
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      firmId: user.firmId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firmId: true,
      originalName: true,
      storageKey: true,
      mimeType: true,
      fileSizeBytes: true,
    },
  });

  if (!document) {
    return NextResponse.json(
      {
        error: "Document not found.",
      },
      {
        status: 404,
      },
    );
  }

  let fileBuffer: Buffer;

  try {
    fileBuffer = await readDocumentFile(
      document.storageKey,
    );
  } catch {
    return NextResponse.json(
      {
        error: "Document file could not be read.",
      },
      {
        status: 404,
      },
    );
  }

  await audit({
    firmId: user.firmId,
    userId: user.id,
    action: "DOWNLOAD",
    entity: "Document",
    entityId: document.id,
    metadata: {
      originalName: document.originalName,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
    },
  });

  const fileName = safeDownloadName(
    document.originalName,
  );

  return new NextResponse(fileBuffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        document.mimeType ||
        "application/octet-stream",

      "Content-Length":
        String(fileBuffer.length),

      "Content-Disposition":
        `inline; filename="${fileName}"`,

      "Cache-Control":
        "private, no-store, max-age=0",

      "X-Content-Type-Options":
        "nosniff",
    },
  });
}