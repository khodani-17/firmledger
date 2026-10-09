"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export async function createTrustReconciliation(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const trustAccountId = String(
    formData.get("trustAccountId") || "",
  );

  const reconciliationDateValue = String(
    formData.get("reconciliationDate") || "",
  );

  const statementBalanceValue = String(
    formData.get("statementBalance") || "",
  );

  const notes = String(
    formData.get("notes") || "",
  ).trim();

  if (!trustAccountId) {
    throw new Error("Please select a trust account.");
  }

  if (!reconciliationDateValue) {
    throw new Error("Please enter a reconciliation date.");
  }

  if (!statementBalanceValue) {
    throw new Error(
      "Please enter the bank statement balance.",
    );
  }

  const statementBalance = Number(
    statementBalanceValue,
  );

  if (!Number.isFinite(statementBalance)) {
    throw new Error(
      "The statement balance must be a valid number.",
    );
  }

  const reconciliationDate = new Date(
    `${reconciliationDateValue}T23:59:59.999`,
  );

  if (Number.isNaN(reconciliationDate.getTime())) {
    throw new Error(
      "The reconciliation date is invalid.",
    );
  }

  const account = await prisma.trustAccount.findFirst({
    where: {
      id: trustAccountId,
      firmId: user.firmId,
      active: true,
    },
  });

  if (!account) {
    throw new Error(
      "Trust account not found.",
    );
  }

  const transactions =
    await prisma.trustTransaction.findMany({
      where: {
        firmId: user.firmId,
        trustAccountId: account.id,
        status: "POSTED",
        transactionDate: {
          lte: reconciliationDate,
        },
      },
      select: {
        type: true,
        amount: true,
      },
    });

  const ledgerBalance = transactions.reduce(
    (balance, transaction) => {
      const amount = Number(transaction.amount);

      switch (transaction.type) {
        case "RECEIPT":
        case "INTEREST":
        case "REVERSAL":
          return balance + amount;

        case "PAYMENT":
        case "REFUND":
        case "FEE":
          return balance - amount;

        case "TRANSFER":
        case "ADJUSTMENT":
        default:
          return balance;
      }
    },
    0,
  );

  const difference =
    statementBalance - ledgerBalance;

  const reconciliation =
    await prisma.trustReconciliation.create({
      data: {
        firmId: user.firmId,
        trustAccountId: account.id,
        reconciliationDate,
        statementBalance,
        ledgerBalance,
        difference,
        status: "OPEN",
        notes: notes || null,
      },
    });

  revalidatePath("/trust");
  revalidatePath("/trust/reconciliation");

  redirect(
    `/trust/reconciliation?created=${reconciliation.id}`,
  );
}