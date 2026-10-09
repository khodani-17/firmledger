"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export async function closeFinancialPeriod(periodId: string) {
  const user = await requireRole(["OWNER", "ADMIN", "FINANCE"]);

  const period = await prisma.financialPeriod.findFirst({
    where: {
      id: periodId,
      firmId: user.firmId,
    },
    include: {
      reviews: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!period) {
    throw new Error("Financial period not found.");
  }

  if (period.status !== "OPEN") {
    throw new Error("Only an OPEN financial period can be closed.");
  }

  const hasRejectedReview = period.reviews.some(
    (review) => review.status === "REJECTED",
  );

  const hasFlaggedReview = period.reviews.some(
    (review) => review.status === "FLAGGED",
  );

  if (hasRejectedReview || hasFlaggedReview) {
    throw new Error(
      "The financial period has rejected or flagged review items. Resolve them before closing.",
    );
  }

  const hasApprovedOrReviewed = period.reviews.some(
    (review) =>
      review.status === "APPROVED" ||
      review.status === "REVIEWED",
  );

  if (period.reviews.length > 0 && !hasApprovedOrReviewed) {
    throw new Error(
      "The financial period requires an approved or reviewed accounting review before it can be closed.",
    );
  }

  await prisma.financialPeriod.update({
    where: {
      id: period.id,
    },
    data: {
      status: "CLOSED",
      closedBy: user.id,
      closedAt: new Date(),
    },
  });

  revalidatePath("/accounting/financial-periods");
  revalidatePath("/accounting/trial-balance");
  revalidatePath("/accounting/profit-loss");
  revalidatePath("/accounting/balance-sheet");
  revalidatePath("/accounting/general-ledger");
}

export async function lockFinancialPeriod(periodId: string) {
  const user = await requireRole(["OWNER", "ADMIN"]);

  const period = await prisma.financialPeriod.findFirst({
    where: {
      id: periodId,
      firmId: user.firmId,
    },
  });

  if (!period) {
    throw new Error("Financial period not found.");
  }

  if (period.status !== "CLOSED") {
    throw new Error(
      "Only a CLOSED financial period can be locked.",
    );
  }

  await prisma.financialPeriod.update({
    where: {
      id: period.id,
    },
    data: {
      status: "LOCKED",
    },
  });

  revalidatePath("/accounting/financial-periods");
  revalidatePath("/accounting/trial-balance");
  revalidatePath("/accounting/profit-loss");
  revalidatePath("/accounting/balance-sheet");
  revalidatePath("/accounting/general-ledger");
}