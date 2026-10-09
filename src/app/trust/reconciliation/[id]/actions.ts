"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const allowedRoles = [
  "OWNER",
  "ADMIN",
  "FINANCE",
  "ACCOUNTANT",
] satisfies Parameters<typeof requireRole>[0];

async function getReconciliation(
  id: string,
  firmId: string,
) {
  return prisma.trustReconciliation.findFirst({
    where: {
      id,
      firmId,
    },
  });
}

export async function startTrustReconciliation(
  reconciliationId: string,
) {
  const user = await requireRole(allowedRoles);

  const reconciliation = await getReconciliation(
    reconciliationId,
    user.firmId,
  );

  if (!reconciliation) {
    throw new Error("Trust reconciliation not found.");
  }

  if (reconciliation.status !== "OPEN") {
    throw new Error(
      "Only an OPEN reconciliation can be started.",
    );
  }

  await prisma.trustReconciliation.update({
    where: {
      id: reconciliation.id,
    },
    data: {
      status: "IN_PROGRESS",
    },
  });

  revalidatePath("/trust");
  revalidatePath("/trust/reconciliation");
  revalidatePath(
    `/trust/reconciliation/${reconciliation.id}`,
  );
}

export async function completeTrustReconciliation(
  reconciliationId: string,
) {
  const user = await requireRole(allowedRoles);

  const reconciliation = await getReconciliation(
    reconciliationId,
    user.firmId,
  );

  if (!reconciliation) {
    throw new Error("Trust reconciliation not found.");
  }

  if (
    reconciliation.status !== "OPEN" &&
    reconciliation.status !== "IN_PROGRESS"
  ) {
    throw new Error(
      "Only an OPEN or IN_PROGRESS reconciliation can be completed.",
    );
  }

  const difference = Number(
    reconciliation.difference,
  );

  if (Math.abs(difference) >= 0.01) {
    throw new Error(
      "The reconciliation cannot be completed while a difference remains.",
    );
  }

  await prisma.trustReconciliation.update({
    where: {
      id: reconciliation.id,
    },
    data: {
      status: "COMPLETED",
    },
  });

  revalidatePath("/trust");
  revalidatePath("/trust/reconciliation");
  revalidatePath(
    `/trust/reconciliation/${reconciliation.id}`,
  );
}

export async function updateTrustReconciliationNotes(
  reconciliationId: string,
  notes: string,
) {
  const user = await requireRole(allowedRoles);

  const reconciliation = await getReconciliation(
    reconciliationId,
    user.firmId,
  );

  if (!reconciliation) {
    throw new Error("Trust reconciliation not found.");
  }

  if (reconciliation.status === "COMPLETED") {
    throw new Error(
      "Completed reconciliations cannot be edited.",
    );
  }

  await prisma.trustReconciliation.update({
    where: {
      id: reconciliation.id,
    },
    data: {
      notes: notes.trim() || null,
    },
  });

  revalidatePath(
    `/trust/reconciliation/${reconciliation.id}`,
  );
  revalidatePath("/trust/reconciliation");
  revalidatePath("/trust");
}