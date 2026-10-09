"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import {
  deleteDocumentFile,
  saveDocumentFile,
} from "@/lib/documents";
import { requireRole } from "@/lib/permissions";

const ALLOWED_DOCUMENT_TYPES = new Set([
  "BANK_STATEMENT",
  "SUPPLIER_INVOICE",
  "RECEIPT",
  "PROOF_OF_PAYMENT",
  "TAX_DOCUMENT",
  "EXPENSE_RECEIPT",
  "CONTRACT",
  "ACCOUNTING_SCHEDULE",
  "VAT_DOCUMENT",
  "INVOICE",
  "CREDIT_NOTE",
  "TRUST_DOCUMENT",
  "FINANCIAL_STATEMENT",
  "OTHER",
]);

export async function uploadDocument(
  formData: FormData,
): Promise<void> {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Please select a document.");
  }

  const documentType = String(
    formData.get("documentType") || "OTHER",
  ).trim();

  if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
    throw new Error("Invalid document type.");
  }

  const description =
    String(
      formData.get("description") || "",
    ).trim() || null;

  const clientId =
    String(
      formData.get("clientId") || "",
    ).trim() || null;

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const saved = await saveDocumentFile(
    user.firmId,
    file,
  );

  try {
    await prisma.$transaction(
      async (tx) => {
        if (clientId) {
          const client =
            await tx.client.findFirst({
              where: {
                id: clientId,
                firmId: user.firmId,
              },
              select: {
                id: true,
              },
            });

          if (!client) {
            throw new Error(
              "Client not found.",
            );
          }
        }

        if (matterId) {
          const matter =
            await tx.matter.findFirst({
              where: {
                id: matterId,
                firmId: user.firmId,
              },
              select: {
                id: true,
              },
            });

          if (!matter) {
            throw new Error(
              "Matter not found.",
            );
          }
        }

        const created =
          await tx.document.create({
            data: {
              firmId: user.firmId,

              originalName: file.name,
              storageName: saved.storageName,
              storageKey: saved.storageKey,
              storageProvider:
                saved.storageProvider,

              mimeType: saved.mimeType,
              fileSizeBytes:
                saved.fileSizeBytes,
              checksum: saved.checksum,

              documentType:
                documentType as any,

              status: "ACTIVE",

              description,

              uploadedById: user.id,

              clientId,
              matterId,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "UPLOAD",
          entity: "Document",
          entityId: created.id,
          metadata: {
            originalName:
              created.originalName,
            documentType:
              created.documentType,
            fileSizeBytes:
              created.fileSizeBytes,
            mimeType:
              created.mimeType,
            checksum:
              created.checksum,
          },
        });
      },
    );

    revalidatePath("/documents");
  } catch (error) {
    try {
      await deleteDocumentFile(
        saved.storageKey,
      );
    } catch {
      // Preserve the original database error
      // if physical file cleanup fails.
    }

    throw error;
  }
}

export async function archiveDocument(
  formData: FormData,
): Promise<void> {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const documentId = String(
    formData.get("documentId") || "",
  ).trim();

  if (!documentId) {
    throw new Error(
      "Document ID is required.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const document =
        await tx.document.findFirst({
          where: {
            id: documentId,
            firmId: user.firmId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            originalName: true,
            documentType: true,
          },
        });

      if (!document) {
        throw new Error(
          "Active document not found.",
        );
      }

      await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          status: "ARCHIVED",
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "ARCHIVE",
        entity: "Document",
        entityId: document.id,
        metadata: {
          originalName:
            document.originalName,
          documentType:
            document.documentType,
        },
      });
    },
  );

  revalidatePath("/documents");
}