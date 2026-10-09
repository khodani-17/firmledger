import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type AuditDb = Prisma.TransactionClient | typeof prisma;

type AuditInput = {
  firmId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: unknown;
};

export async function audit(input: AuditInput): Promise<void>;
export async function audit(
  db: AuditDb,
  input: AuditInput
): Promise<void>;

export async function audit(
  dbOrInput: AuditDb | AuditInput,
  maybeInput?: AuditInput
) {
  const db: AuditDb =
    maybeInput === undefined ? prisma : (dbOrInput as AuditDb);

  const input: AuditInput =
    maybeInput === undefined
      ? (dbOrInput as AuditInput)
      : maybeInput;

  await db.auditLog.create({
    data: {
      firmId: input.firmId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}