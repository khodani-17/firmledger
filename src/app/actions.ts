"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/permissions";
import {
  postInvoice,
  postPayment,
  postExpense,
  postPurchaseInvoice,
  postSupplierPayment,
} from "@/lib/posting";

const money = (value: string) => {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Invalid amount.");
  }

  return Math.round(n * 100) / 100;
};

/* =========================================================
   CLIENTS
========================================================= */

export async function createClient(formData: FormData) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const displayName = String(
    formData.get("displayName") || "",
  ).trim();

  if (!displayName) {
    throw new Error("Client name is required.");
  }

  const client = await prisma.$transaction(
    async (tx) => {
      const count = await tx.client.count({
        where: {
          firmId: user.firmId,
        },
      });

      const clientCode = `CL-${String(
        count + 1,
      ).padStart(4, "0")}`;

      const created = await tx.client.create({
        data: {
          firmId: user.firmId,
          clientCode,
          displayName,
          email:
            String(
              formData.get("email") || "",
            ).trim() || null,
          phone:
            String(
              formData.get("phone") || "",
            ).trim() || null,
          type: String(
            formData.get("type") || "INDIVIDUAL",
          ) as any,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CREATE",
        entity: "Client",
        entityId: created.id,
      });

      return created;
    },
  );

  revalidatePath("/clients");
  redirect("/clients");
}

/* =========================================================
   MATTERS
========================================================= */

export async function createMatter(formData: FormData) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  const clientId = String(
    formData.get("clientId") || "",
  ).trim();

  const title = String(
    formData.get("title") || "",
  ).trim();

  if (!clientId || !title) {
    throw new Error(
      "Client and matter title are required.",
    );
  }

  const matter = await prisma.$transaction(
    async (tx) => {
      const client = await tx.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      });

      if (!client) {
        throw new Error("Client not found.");
      }

      const count = await tx.matter.count({
        where: {
          firmId: user.firmId,
        },
      });

      const matterNumber = `MAT-${new Date().getFullYear()}-${String(
        count + 1,
      ).padStart(4, "0")}`;

      const created = await tx.matter.create({
        data: {
          firmId: user.firmId,
          clientId,
          matterNumber,
          title,
          description:
            String(
              formData.get("description") || "",
            ).trim() || null,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CREATE",
        entity: "Matter",
        entityId: created.id,
      });

      return created;
    },
  );

  revalidatePath("/matters");
  redirect("/matters");
}

/* =========================================================
   INVOICES
========================================================= */

export async function createInvoice(formData: FormData) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "ACCOUNTANT",
  ]);

  const clientId = String(
    formData.get("clientId") || "",
  ).trim();

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const description = String(
    formData.get("description") || "",
  ).trim();

  const subtotalRaw = String(
    formData.get("subtotal") || "0",
  );

  const taxRateRaw = String(
    formData.get("taxRate") || "0",
  );

  const subtotal = money(subtotalRaw);
  const taxRate = money(taxRateRaw);

  if (!clientId || !description || subtotal <= 0) {
    throw new Error(
      "Client, description and amount are required.",
    );
  }

  if (taxRate < 0 || taxRate > 100) {
    throw new Error(
      "VAT rate must be between 0% and 100%.",
    );
  }

  const taxAmount =
    Math.round(subtotal * taxRate) / 100;

  const total =
    Math.round(
      (subtotal + taxAmount) * 100,
    ) / 100;

  if (
    !Number.isFinite(taxAmount) ||
    !Number.isFinite(total)
  ) {
    throw new Error(
      "Invalid invoice calculation.",
    );
  }

  if (taxAmount < 0) {
    throw new Error(
      "Invoice tax amount cannot be negative.",
    );
  }

  if (total <= 0) {
    throw new Error(
      "Invoice total must be greater than zero.",
    );
  }

  const issueDate = new Date();

  const dueDate = new Date(issueDate);
  dueDate.setDate(
    dueDate.getDate() + 30,
  );

  const invoice = await prisma.$transaction(
    async (tx) => {
      const client = await tx.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
        select: {
          id: true,
        },
      });

      if (!client) {
        throw new Error("Client not found.");
      }

      if (matterId) {
        const matter = await tx.matter.findFirst({
          where: {
            id: matterId,
            firmId: user.firmId,
            clientId,
          },
          select: {
            id: true,
          },
        });

        if (!matter) {
          throw new Error(
            "Matter does not belong to this client.",
          );
        }
      }

      const count = await tx.invoice.count({
        where: {
          firmId: user.firmId,
        },
      });

      const invoiceNumber = `INV-${String(
        count + 1,
      ).padStart(4, "0")}`;

      const created = await tx.invoice.create({
        data: {
          firmId: user.firmId,
          clientId,
          matterId,
          invoiceNumber,
          issueDate,
          dueDate,
          status: "SENT",

          subtotal,
          taxAmount,
          total,

          amountPaid: 0,
          balanceDue: total,

          items: {
            create: [
              {
                description,
                quantity: 1,
                unitPrice: subtotal,
                taxRate,
                taxAmount,
                lineTotal: total,
              },
            ],
          },
        },
      });

      const journalEntry = await postInvoice(tx, {
        firmId: user.firmId,
        invoiceId: created.id,
        invoiceNumber,
        entryDate: issueDate,
        subtotal,
        taxAmount,
      });

      await tx.accountantReview.create({
        data: {
          firmId: user.firmId,
          periodId: journalEntry.periodId,
          title: `Review invoice ${invoiceNumber}`,
          status: "PENDING",
          notes: `System-posted invoice for R${total.toFixed(
            2,
          )}.`,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CREATE_AND_POST",
        entity: "Invoice",
        entityId: created.id,
        metadata: {
          invoiceNumber,
          subtotal,
          taxRate,
          taxAmount,
          total,
        },
      });

      return created;
    },
    {
      timeout: 15000,
    },
  );

  revalidatePath("/billing");
  revalidatePath("/accounting");
  revalidatePath("/reports");
  revalidatePath("/");

  redirect("/billing");
}

/* =========================================================
   PAYMENTS
========================================================= */

export async function createPayment(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const invoiceId = String(
    formData.get("invoiceId") || "",
  ).trim();

  const bankAccountId = String(
    formData.get("bankAccountId") || "",
  ).trim();

  const amount = money(
    String(
      formData.get("amount") || "0",
    ),
  );

  const reference = String(
    formData.get("reference") || "",
  ).trim();

  const method = String(
    formData.get("method") || "EFT",
  ).trim();

  if (
    !invoiceId ||
    !bankAccountId ||
    amount <= 0 ||
    !reference
  ) {
    throw new Error(
      "Invoice, bank account, amount and reference are required.",
    );
  }

  const payment = await prisma.$transaction(
    async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          firmId: user.firmId,
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (invoice.status === "VOID") {
        throw new Error(
          "Payments cannot be recorded against a void invoice.",
        );
      }

      const balance = Number(
        invoice.balanceDue,
      );

      if (!Number.isFinite(balance) || balance < 0) {
        throw new Error(
          "Invoice has an invalid outstanding balance.",
        );
      }

      if (balance <= 0) {
        throw new Error(
          "This invoice has no outstanding balance.",
        );
      }

      if (amount > balance + 0.0001) {
        throw new Error(
          `Payment exceeds the invoice balance of R${balance.toFixed(
            2,
          )}.`,
        );
      }

      const bank = await tx.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          firmId: user.firmId,
          active: true,
          isTrust: false,
        },
      });

      if (!bank) {
        throw new Error(
          "Business bank account not found.",
        );
      }

      const paymentDate = new Date();

      const created = await tx.payment.create({
        data: {
          firmId: user.firmId,
          clientId: invoice.clientId,
          matterId: invoice.matterId,
          invoiceId,
          reference,
          paymentDate,
          amount,
          status: "COMPLETED",
          method,
        },
      });

      const newPaid =
        Math.round(
          (Number(invoice.amountPaid) +
            amount) *
            100,
        ) / 100;

      const newBalance =
        Math.round(
          (balance - amount) *
            100,
        ) / 100;

      await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          amountPaid: newPaid,
          balanceDue: newBalance,
          status:
            newBalance === 0
              ? "PAID"
              : "PARTIALLY_PAID",
        },
      });

      const journalEntry = await postPayment(tx, {
        firmId: user.firmId,
        paymentId: created.id,
        reference,
        entryDate: paymentDate,
        amount,
      });

      await tx.bankTransaction.create({
        data: {
          firmId: user.firmId,
          bankAccountId,
          paymentId: created.id,
          transactionDate: paymentDate,
          description: `Client payment - ${invoice.invoiceNumber}`,
          reference,
          amount,
          type: "CREDIT",
          matched: true,
        },
      });

      await tx.accountantReview.create({
        data: {
          firmId: user.firmId,
          periodId: journalEntry.periodId,
          title: `Review payment ${reference}`,
          status: "PENDING",
          notes: `R${amount.toFixed(
            2,
          )} allocated to ${invoice.invoiceNumber}.`,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CREATE_AND_POST",
        entity: "Payment",
        entityId: created.id,
        metadata: {
          reference,
          amount,
          invoiceId,
        },
      });

      return created;
    },
    {
      timeout: 15000,
    },
  );

  revalidatePath("/payments");
  revalidatePath("/billing");
  revalidatePath("/banking");
  revalidatePath("/accounting");
  revalidatePath("/reports");
  revalidatePath("/");

  redirect("/payments");
}

/* =========================================================
   EXPENSES
========================================================= */

export async function createExpense(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const description = String(
    formData.get("description") || "",
  ).trim();

  const clientId =
    String(
      formData.get("clientId") || "",
    ).trim() || null;

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const bankAccountId = String(
    formData.get("bankAccountId") || "",
  ).trim();

  const netAmount = money(
    String(
      formData.get("amount") || "0",
    ),
  );

  const taxAmount = money(
    String(
      formData.get("taxAmount") || "0",
    ),
  );

  const reference = String(
    formData.get("reference") || "",
  ).trim();

  if (
    !description ||
    !bankAccountId ||
    netAmount <= 0
  ) {
    throw new Error(
      "Description, bank account and amount are required.",
    );
  }

  const total = Math.round(
    (netAmount + taxAmount) * 100,
  ) / 100;

  if (total <= 0) {
    throw new Error(
      "Expense total must be greater than zero.",
    );
  }

  const expense = await prisma.$transaction(
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
              ...(clientId
                ? { clientId }
                : {}),
            },
            select: {
              id: true,
            },
          });

        if (!matter) {
          throw new Error(
            "Matter not found or does not match the client.",
          );
        }
      }

      const bank =
        await tx.bankAccount.findFirst({
          where: {
            id: bankAccountId,
            firmId: user.firmId,
            active: true,
            isTrust: false,
          },
        });

      if (!bank) {
        throw new Error(
          "Business bank account not found.",
        );
      }

      const expenseDate = new Date();

      const created =
        await tx.expense.create({
          data: {
            firmId: user.firmId,
            clientId,
            matterId,
            bankAccountId,
            description,
            amount: netAmount,
            taxAmount,
            status: "PAID",
            expenseDate,
          },
        });

      const journalEntry = await postExpense(tx, {
        firmId: user.firmId,
        expenseId: created.id,
        description,
        entryDate: expenseDate,
        netAmount,
        taxAmount,
      });

      await tx.bankTransaction.create({
        data: {
          firmId: user.firmId,
          bankAccountId,
          transactionDate: expenseDate,
          description: `Expense - ${description}`,
          reference: reference || null,
          amount: total,
          type: "DEBIT",
          matched: true,
        },
      });

      await tx.accountantReview.create({
        data: {
          firmId: user.firmId,
          periodId: journalEntry.periodId,
          title: `Review expense ${description}`,
          status: "PENDING",
          notes: `Paid expense of R${total.toFixed(
            2,
          )}${
            reference
              ? ` (${reference})`
              : ""
          }.`,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CREATE_AND_POST",
        entity: "Expense",
        entityId: created.id,
        metadata: {
          amount: netAmount,
          taxAmount,
          total,
        },
      });

      return created;
    },
    {
      timeout: 15000,
    },
  );

  revalidatePath("/expenses");
  revalidatePath("/banking");
  revalidatePath("/accounting");
  revalidatePath("/reports");

  redirect("/expenses");
}

/* =========================================================
   ACCOUNTANT REVIEW
========================================================= */

export async function reviewItem(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const reviewId = String(
    formData.get("reviewId") || "",
  ).trim();

  const status = String(
    formData.get("status") || "REVIEWED",
  );

  if (
    ![
      "REVIEWED",
      "FLAGGED",
      "CORRECTED",
    ].includes(status)
  ) {
    throw new Error(
      "Invalid review status.",
    );
  }

  const review =
    await prisma.accountantReview.findFirst({
      where: {
        id: reviewId,
        firmId: user.firmId,
      },
    });

  if (!review) {
    throw new Error(
      "Review item not found.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.accountantReview.update({
        where: {
          id: review.id,
        },
        data: {
          status: status as any,
          reviewerId: user.id,
          reviewedAt: new Date(),
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "REVIEW",
        entity: "AccountantReview",
        entityId: review.id,
        metadata: {
          status,
        },
      });
    },
  );

  revalidatePath("/accounting");
}

/* =========================================================
   BANK TRANSACTIONS
========================================================= */

export async function addBankTransaction(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const bankAccountId = String(
    formData.get("bankAccountId") || "",
  ).trim();

  const description = String(
    formData.get("description") || "",
  ).trim();

  const reference =
    String(
      formData.get("reference") || "",
    ).trim() || null;

  const amount = money(
    String(
      formData.get("amount") || "0",
    ),
  );

  const type = String(
    formData.get("type") || "CREDIT",
  );

  if (
    !bankAccountId ||
    !description ||
    amount <= 0 ||
    !["CREDIT", "DEBIT"].includes(type)
  ) {
    throw new Error(
      "Bank, description, amount and transaction type are required.",
    );
  }

  const tx =
    await prisma.$transaction(
      async (db) => {
        const bank =
          await db.bankAccount.findFirst({
            where: {
              id: bankAccountId,
              firmId: user.firmId,
              active: true,
              isTrust: false,
            },
          });

        if (!bank) {
          throw new Error(
            "Business bank account not found.",
          );
        }

        const created =
          await db.bankTransaction.create({
            data: {
              firmId: user.firmId,
              bankAccountId,
              transactionDate: new Date(),
              description,
              reference,
              amount,
              type: type as any,
              matched: false,
            },
          });

        await audit(db, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "BankTransaction",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/banking");
  revalidatePath(
    "/banking/reconciliation",
  );

  redirect("/banking/reconciliation");
}

/* =========================================================
   BANK RECONCILIATION
========================================================= */

export async function reconcileBankTransaction(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const bankTransactionId = String(
    formData.get("bankTransactionId") || "",
  ).trim();

  const paymentId = String(
    formData.get("paymentId") || "",
  ).trim();

  if (!bankTransactionId) {
    throw new Error(
      "Bank transaction is required.",
    );
  }

  if (!paymentId) {
    throw new Error(
      "Select a payment to reconcile.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const transaction =
        await tx.bankTransaction.findFirst({
          where: {
            id: bankTransactionId,
            firmId: user.firmId,
            matched: false,
          },
        });

      if (!transaction) {
        throw new Error(
          "Unmatched bank transaction not found.",
        );
      }

      const payment =
        await tx.payment.findFirst({
          where: {
            id: paymentId,
            firmId: user.firmId,
            status: "COMPLETED",
          },
          include: {
            bankTransactions: true,
          },
        });

      if (!payment) {
        throw new Error(
          "Payment not found.",
        );
      }

      if (transaction.type !== "CREDIT") {
        throw new Error(
          "This reconciliation flow only matches incoming client receipts.",
        );
      }

      if (
        Math.abs(
          Number(transaction.amount) -
            Number(payment.amount),
        ) > 0.001
      ) {
        throw new Error(
          "Bank amount and payment amount do not match.",
        );
      }

      if (payment.bankTransactions.length) {
        throw new Error(
          "Payment is already linked to a bank transaction.",
        );
      }

      await tx.bankTransaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          matched: true,
          paymentId: payment.id,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "RECONCILE",
        entity: "BankTransaction",
        entityId: transaction.id,
        metadata: {
          paymentId,
        },
      });
    },
  );

  revalidatePath("/banking");
  revalidatePath(
    "/banking/reconciliation",
  );

  redirect("/banking/reconciliation");
}

/* =========================================================
   BUSINESS BANK ACCOUNTS
========================================================= */

export async function createBankAccount(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const name = String(
    formData.get("name") || "",
  ).trim();

  const bankName =
    String(
      formData.get("bankName") || "",
    ).trim() || null;

  const accountNumber =
    String(
      formData.get("accountNumber") || "",
    ).trim() || null;

  const isTrust =
    String(
      formData.get("isTrust") || "",
    ) === "true";

  if (!name) {
    throw new Error(
      "Account name is required.",
    );
  }

  if (isTrust) {
    throw new Error(
      "Use the dedicated Trust Accounts module for trust banking.",
    );
  }

  const account =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.bankAccount.create({
            data: {
              firmId: user.firmId,
              name,
              bankName,
              accountNumber,
              isTrust: false,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "BankAccount",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/banking");
  redirect("/banking");
}

/* =========================================================
   SUPPLIERS
========================================================= */

export async function createSupplier(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const name = String(
    formData.get("name") || "",
  ).trim();

  if (!name) {
    throw new Error(
      "Supplier name is required.",
    );
  }

  const supplier =
    await prisma.$transaction(
      async (tx) => {
        const count =
          await tx.supplier.count({
            where: {
              firmId: user.firmId,
            },
          });

        const created =
          await tx.supplier.create({
            data: {
              firmId: user.firmId,
              supplierCode: `SUP-${String(
                count + 1,
              ).padStart(4, "0")}`,
              name,
              type: String(
                formData.get("type") ||
                  "COMPANY",
              ) as any,
              vatNumber:
                String(
                  formData.get(
                    "vatNumber",
                  ) || "",
                ).trim() || null,
              email:
                String(
                  formData.get("email") ||
                    "",
                ).trim() || null,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "Supplier",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

/* =========================================================
   PURCHASE INVOICES
========================================================= */

export async function createPurchaseInvoice(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const supplierId = String(
    formData.get("supplierId") || "",
  ).trim();

  const invoiceNumber = String(
    formData.get("invoiceNumber") || "",
  ).trim();

  const description = String(
    formData.get("description") || "",
  ).trim();

  const net = money(
    String(
      formData.get("subtotal") || "0",
    ),
  );

  const tax = money(
    String(
      formData.get("taxAmount") || "0",
    ),
  );

  if (
    !supplierId ||
    !invoiceNumber ||
    !description ||
    net <= 0
  ) {
    throw new Error(
      "Supplier, invoice number, description and amount are required.",
    );
  }

  if (tax < 0) {
    throw new Error(
      "Tax amount cannot be negative.",
    );
  }

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const total =
    Math.round(
      (net + tax) * 100,
    ) / 100;

  const date = new Date();

  const due = new Date(date);
  due.setDate(
    due.getDate() + 30,
  );

  const pi =
    await prisma.$transaction(
      async (tx) => {
        const supplier =
          await tx.supplier.findFirst({
            where: {
              id: supplierId,
              firmId: user.firmId,
            },
            select: {
              id: true,
              name: true,
            },
          });

        if (!supplier) {
          throw new Error(
            "Supplier not found.",
          );
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
          await tx.purchaseInvoice.create({
            data: {
              firmId: user.firmId,
              supplierId,
              matterId,
              invoiceNumber,
              invoiceDate: date,
              dueDate: due,
              status: "RECEIVED",
              subtotal: net,
              taxAmount: tax,
              total,
              amountPaid: 0,
              balanceDue: total,
              description,
            },
          });

        const journalEntry =
          await postPurchaseInvoice(tx, {
            firmId: user.firmId,
            id: created.id,
            description: `${supplier.name} ${invoiceNumber}`,
            date,
            net,
            tax,
          });

        await tx.accountantReview.create({
          data: {
            firmId: user.firmId,
            periodId: journalEntry.periodId,
            title: `Review supplier invoice ${invoiceNumber}`,
            status: "PENDING",
            notes: `R${total.toFixed(
              2,
            )} payable to ${supplier.name}.`,
          },
        });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE_AND_POST",
          entity: "PurchaseInvoice",
          entityId: created.id,
          metadata: {
            total,
          },
        });

        return created;
      },
      {
        timeout: 15000,
      },
    );

  revalidatePath("/purchases");
  revalidatePath("/accounting");
  revalidatePath("/reports");

  redirect("/purchases");
}

/* =========================================================
   TRUST ACCOUNTS
========================================================= */

export async function createTrustAccount(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const name = String(
    formData.get("name") || "",
  ).trim();

  if (!name) {
    throw new Error(
      "Trust account name is required.",
    );
  }

  const account =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.trustAccount.create({
            data: {
              firmId: user.firmId,
              name,
              bankName:
                String(
                  formData.get(
                    "bankName",
                  ) || "",
                ).trim() || null,
              accountNumber:
                String(
                  formData.get(
                    "accountNumber",
                  ) || "",
                ).trim() || null,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "TrustAccount",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/trust");
  redirect("/trust");
}

/* =========================================================
   TRUST TRANSACTIONS
========================================================= */

export async function createTrustTransaction(
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
  ).trim();

  const clientId = String(
    formData.get("clientId") || "",
  ).trim();

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const amount = money(
    String(
      formData.get("amount") || "0",
    ),
  );

  const type = String(
    formData.get("type") || "RECEIPT",
  );

  const description = String(
    formData.get("description") || "",
  ).trim();

  const reference =
    String(
      formData.get("reference") || "",
    ).trim() || null;

  if (
    !trustAccountId ||
    !clientId ||
    !description ||
    amount <= 0 ||
    ![
      "RECEIPT",
      "PAYMENT",
      "TRANSFER",
      "INTEREST",
      "FEE",
      "REVERSAL",
    ].includes(type)
  ) {
    throw new Error(
      "Trust account, client, description and valid amount are required.",
    );
  }

  const tx =
    await prisma.$transaction(
      async (db) => {
        const ta =
          await db.trustAccount.findFirst({
            where: {
              id: trustAccountId,
              firmId: user.firmId,
              active: true,
            },
          });

        if (!ta) {
          throw new Error(
            "Trust account not found.",
          );
        }

        const client =
          await db.client.findFirst({
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

        if (matterId) {
          const matter =
            await db.matter.findFirst({
              where: {
                id: matterId,
                firmId: user.firmId,
                clientId,
              },
              select: {
                id: true,
              },
            });

          if (!matter) {
            throw new Error(
              "Matter does not belong to the client.",
            );
          }
        }

        const current =
          await db.trustTransaction.findMany({
            where: {
              trustAccountId,
              status: "POSTED",
            },
            select: {
              amount: true,
              type: true,
            },
          });

        const balance =
          current.reduce(
            (sum, transaction) => {
              const incoming =
                transaction.type ===
                  "RECEIPT" ||
                transaction.type ===
                  "INTEREST";

              return (
                sum +
                (incoming
                  ? Number(
                      transaction.amount,
                    )
                  : -Number(
                      transaction.amount,
                    ))
              );
            },
            0,
          );

        if (
          [
            "PAYMENT",
            "TRANSFER",
            "FEE",
          ].includes(type) &&
          amount > balance + 0.001
        ) {
          throw new Error(
            `Insufficient trust funds. Available balance: R${balance.toFixed(
              2,
            )}.`,
          );
        }

        const created =
          await db.trustTransaction.create({
            data: {
              firmId: user.firmId,
              trustAccountId,
              clientId,
              matterId,
              type: type as any,
              status: "POSTED",
              transactionDate: new Date(),
              reference,
              description,
              amount,
              createdById: user.id,
            },
          });

        await audit(db, {
          firmId: user.firmId,
          userId: user.id,
          action: "POST",
          entity: "TrustTransaction",
          entityId: created.id,
          metadata: {
            amount,
            type,
            clientId,
            matterId,
          },
        });

        return created;
      },
    );

  revalidatePath("/trust");
  redirect("/trust");
}

/* =========================================================
   FINANCIAL PERIODS
========================================================= */

export async function createFinancialPeriod(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const name = String(
    formData.get("name") || "",
  ).trim();

  const start = new Date(
    String(
      formData.get("startDate") || "",
    ),
  );

  const end = new Date(
    String(
      formData.get("endDate") || "",
    ),
  );

  if (
    !name ||
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    start >= end
  ) {
    throw new Error(
      "Valid period dates are required.",
    );
  }

  const period =
    await prisma.$transaction(
      async (tx) => {
        const overlapping =
          await tx.financialPeriod.findFirst({
            where: {
              firmId: user.firmId,
              startDate: {
                lt: end,
              },
              endDate: {
                gt: start,
              },
            },
            select: {
              id: true,
              name: true,
            },
          });

        if (overlapping) {
          throw new Error(
            `Financial period overlaps with "${overlapping.name}".`,
          );
        }

        const created =
          await tx.financialPeriod.create({
            data: {
              firmId: user.firmId,
              name,
              startDate: start,
              endDate: end,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "FinancialPeriod",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/periods");
  redirect("/periods");
}

/* =========================================================
   CLOSE FINANCIAL PERIOD
========================================================= */

export async function closeFinancialPeriod(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "ACCOUNTANT",
  ]);

  const periodId = String(
    formData.get("periodId") || "",
  ).trim();

  if (!periodId) {
    throw new Error(
      "Financial period is required.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const period =
        await tx.financialPeriod.findFirst({
          where: {
            id: periodId,
            firmId: user.firmId,
          },
        });

      if (!period) {
        throw new Error(
          "Period not found.",
        );
      }

      if (period.status !== "OPEN") {
        throw new Error(
          `This financial period is already ${period.status.toLowerCase()}.`,
        );
      }

      const pending =
        await tx.accountantReview.count({
          where: {
            firmId: user.firmId,
            periodId,
            status: {
              in: [
                "PENDING",
                "IN_REVIEW",
                "FLAGGED",
              ],
            },
          },
        });

      if (pending) {
        throw new Error(
          `Cannot close the period while ${pending} review item(s) remain unresolved.`,
        );
      }

      await tx.financialPeriod.update({
        where: {
          id: period.id,
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: user.id,
        },
      });

      await audit(tx, {
        firmId: user.firmId,
        userId: user.id,
        action: "CLOSE",
        entity: "FinancialPeriod",
        entityId: period.id,
      });
    },
  );

  revalidatePath("/periods");
  redirect("/periods");
}

/* =========================================================
   TAX RETURNS
========================================================= */

export async function createTaxReturn(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const start = new Date(
    String(
      formData.get("periodStart") || "",
    ),
  );

  const end = new Date(
    String(
      formData.get("periodEnd") || "",
    ),
  );

  if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    start >= end
  ) {
    throw new Error(
      "Valid tax period required.",
    );
  }

  const lines =
    await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          firmId: user.firmId,
          entryDate: {
            gte: start,
            lte: end,
          },
        },
      },
      include: {
        ledgerAccount: true,
      },
    });

  const output = lines
    .filter(
      (line) =>
        line.ledgerAccount.code ===
        "2000",
    )
    .reduce(
      (sum, line) =>
        sum +
        Number(line.credit) -
        Number(line.debit),
      0,
    );

  const input = lines
    .filter(
      (line) =>
        line.ledgerAccount.code ===
        "2100",
    )
    .reduce(
      (sum, line) =>
        sum +
        Number(line.debit) -
        Number(line.credit),
      0,
    );

  const net = output - input;

  const ret =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.taxReturn.create({
            data: {
              firmId: user.firmId,
              returnType: String(
                formData.get(
                  "returnType",
                ) || "VAT201",
              ),
              periodStart: start,
              periodEnd: end,
              outputVat: output,
              inputVat: input,
              netVat: net,
              status: "PREPARED",
              preparedBy: user.id,
              preparedAt: new Date(),
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "PREPARE",
          entity: "TaxReturn",
          entityId: created.id,
          metadata: {
            output,
            input,
            net,
          },
        });

        return created;
      },
    );

  revalidatePath("/tax");
  redirect("/tax");
}

/* =========================================================
   RECURRING INVOICES
========================================================= */

export async function createRecurringInvoice(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "ACCOUNTANT",
  ]);

  const clientId = String(
    formData.get("clientId") || "",
  ).trim();

  const matterId =
    String(
      formData.get("matterId") || "",
    ).trim() || null;

  const description = String(
    formData.get("description") || "",
  ).trim();

  const subtotal = money(
    String(
      formData.get("subtotal") || "0",
    ),
  );

  const taxRate = money(
    String(
      formData.get("taxRate") || "0",
    ),
  );

  const frequency = String(
    formData.get("frequency") ||
      "MONTHLY",
  ).trim();

  const nextRunDate = new Date(
    String(
      formData.get("nextRunDate") ||
        new Date().toISOString(),
    ),
  );

  if (
    !clientId ||
    !description ||
    subtotal <= 0
  ) {
    throw new Error(
      "Client, description and amount are required.",
    );
  }

  if (taxRate < 0 || taxRate > 100) {
    throw new Error(
      "VAT rate must be between 0% and 100%.",
    );
  }

  if (
    ![
      "WEEKLY",
      "MONTHLY",
      "QUARTERLY",
      "ANNUALLY",
    ].includes(frequency)
  ) {
    throw new Error(
      "Invalid recurring invoice frequency.",
    );
  }

  if (isNaN(nextRunDate.getTime())) {
    throw new Error(
      "Invalid next run date.",
    );
  }

  const rec =
    await prisma.$transaction(
      async (tx) => {
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

        if (matterId) {
          const matter =
            await tx.matter.findFirst({
              where: {
                id: matterId,
                firmId: user.firmId,
                clientId,
              },
              select: {
                id: true,
              },
            });

          if (!matter) {
            throw new Error(
              "Matter does not belong to this client.",
            );
          }
        }

        const created =
          await tx.recurringInvoice.create({
            data: {
              firmId: user.firmId,
              clientId,
              matterId,
              description,
              subtotal,
              taxRate,
              frequency,
              nextRunDate,
            },
          });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "RecurringInvoice",
          entityId: created.id,
        });

        return created;
      },
    );

  revalidatePath("/recurring");
  redirect("/recurring");
}

/* =========================================================
   CREDIT NOTES
========================================================= */

export async function createCreditNote(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const clientId = String(
    formData.get("clientId") || "",
  ).trim();

  const invoiceId =
    String(
      formData.get("invoiceId") || "",
    ).trim() || null;

  const reason = String(
    formData.get("reason") || "",
  ).trim();

  const subtotal = money(
    String(
      formData.get("subtotal") || "0",
    ),
  );

  const tax = money(
    String(
      formData.get("taxAmount") || "0",
    ),
  );

  if (
    !clientId ||
    !reason ||
    subtotal <= 0
  ) {
    throw new Error(
      "Client, reason and amount are required.",
    );
  }

  const total =
    Math.round(
      (subtotal + tax) * 100,
    ) / 100;

  if (total <= 0) {
    throw new Error(
      "Credit note total must be greater than zero.",
    );
  }

  const note =
    await prisma.$transaction(
      async (tx) => {
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

        let invoice:
          | {
              id: string;
              balanceDue: any;
              amountPaid: any;
              total: any;
              status: any;
            }
          | null = null;

        if (invoiceId) {
          invoice =
            await tx.invoice.findFirst({
              where: {
                id: invoiceId,
                firmId: user.firmId,
                clientId,
              },
              select: {
                id: true,
                balanceDue: true,
                amountPaid: true,
                total: true,
                status: true,
              },
            });

          if (!invoice) {
            throw new Error(
              "Invoice does not belong to the client.",
            );
          }

          if (total > Number(invoice.total)) {
            throw new Error(
              "Credit note cannot exceed the original invoice total.",
            );
          }
        }

        const count =
          await tx.creditNote.count({
            where: {
              firmId: user.firmId,
            },
          });

        const created =
          await tx.creditNote.create({
            data: {
              firmId: user.firmId,
              clientId,
              invoiceId,
              creditNumber: `CN-${String(
                count + 1,
              ).padStart(4, "0")}`,
              issueDate: new Date(),
              reason,
              subtotal,
              taxAmount: tax,
              total,
            },
          });

        if (invoice) {
          const newBalance =
            Math.max(
              0,
              Math.round(
                (Number(
                  invoice.balanceDue,
                ) - total) *
                  100,
              ) / 100,
            );

          const newAmountPaid =
            Math.min(
              Number(invoice.amountPaid),
              Number(invoice.total) -
                newBalance,
            );

          await tx.invoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              balanceDue: newBalance,
              amountPaid:
                Math.max(
                  0,
                  newAmountPaid,
                ),
              status:
                newBalance === 0
                  ? "PAID"
                  : invoice.status ===
                      "PAID"
                    ? "PARTIALLY_PAID"
                    : invoice.status,
            },
          });
        }

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE",
          entity: "CreditNote",
          entityId: created.id,
          metadata: {
            total,
            invoiceId,
          },
        });

        return created;
      },
    );

  revalidatePath("/credit-notes");
  revalidatePath("/billing");
  revalidatePath("/accounting");

  redirect("/credit-notes");
}

/* =========================================================
   SUPPLIER PAYMENTS
========================================================= */

export async function createSupplierPayment(
  formData: FormData,
) {
  const user = await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
  ]);

  const supplierId = String(
    formData.get("supplierId") || "",
  ).trim();

  const purchaseInvoiceId =
    String(
      formData.get("purchaseInvoiceId") ||
        "",
    ).trim() || null;

  const bankAccountId = String(
    formData.get("bankAccountId") || "",
  ).trim();

  const reference = String(
    formData.get("reference") || "",
  ).trim();

  const amount = money(
    String(
      formData.get("amount") || "0",
    ),
  );

  if (
    !supplierId ||
    !bankAccountId ||
    !reference ||
    amount <= 0
  ) {
    throw new Error(
      "Supplier, bank account, reference and amount are required.",
    );
  }

  const payment =
    await prisma.$transaction(
      async (tx) => {
        const supplier =
          await tx.supplier.findFirst({
            where: {
              id: supplierId,
              firmId: user.firmId,
            },
            select: {
              id: true,
              name: true,
            },
          });

        if (!supplier) {
          throw new Error(
            "Supplier not found.",
          );
        }

        const existingPayment =
          await tx.supplierPayment.findFirst({
            where: {
              firmId: user.firmId,
              reference,
            },
            select: {
              id: true,
            },
          });

        if (existingPayment) {
          throw new Error(
            `A supplier payment with reference ${reference} already exists.`,
          );
        }

        const bank =
          await tx.bankAccount.findFirst({
            where: {
              id: bankAccountId,
              firmId: user.firmId,
              active: true,
              isTrust: false,
            },
          });

        if (!bank) {
          throw new Error(
            "Business bank account not found.",
          );
        }

        let invoice:
          | {
              id: string;
              balanceDue: any;
            }
          | null = null;

        if (purchaseInvoiceId) {
          invoice =
            await tx.purchaseInvoice.findFirst({
              where: {
                id: purchaseInvoiceId,
                firmId: user.firmId,
                supplierId,
              },
              select: {
                id: true,
                balanceDue: true,
              },
            });

          if (!invoice) {
            throw new Error(
              "Purchase invoice not found.",
            );
          }

          if (
            amount >
            Number(
              invoice.balanceDue,
            ) + 0.001
          ) {
            throw new Error(
              `Payment exceeds payable balance of R${Number(
                invoice.balanceDue,
              ).toFixed(2)}.`,
            );
          }
        }

        const paymentDate =
          new Date();

        const created =
          await tx.supplierPayment.create({
            data: {
              firmId: user.firmId,
              supplierId,
              purchaseInvoiceId,
              bankAccountId,
              paymentDate,
              reference,
              amount,
            },
          });

        if (invoice) {
          const balance =
            Math.round(
              (Number(
                invoice.balanceDue,
              ) - amount) *
                100,
            ) / 100;

          await tx.purchaseInvoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              amountPaid: {
                increment: amount,
              },
              balanceDue: balance,
              status:
                balance === 0
                  ? "PAID"
                  : "PARTIALLY_PAID",
            },
          });
        }

        const journalEntry =
          await postSupplierPayment(tx, {
            firmId: user.firmId,
            id: created.id,
            reference,
            date: paymentDate,
            amount,
          });

        await tx.bankTransaction.create({
          data: {
            firmId: user.firmId,
            bankAccountId,
            transactionDate:
              paymentDate,
            description: `Supplier payment - ${supplier.name}`,
            reference,
            amount,
            type: "DEBIT",
            matched: true,
          },
        });

        await tx.accountantReview.create({
          data: {
            firmId: user.firmId,
            periodId: journalEntry.periodId,
            title: `Review supplier payment ${reference}`,
            status: "PENDING",
            notes: `R${amount.toFixed(
              2,
            )} paid to ${supplier.name}.`,
          },
        });

        await audit(tx, {
          firmId: user.firmId,
          userId: user.id,
          action: "CREATE_AND_POST",
          entity: "SupplierPayment",
          entityId: created.id,
          metadata: {
            amount,
            reference,
            purchaseInvoiceId,
          },
        });

        return created;
      },
      {
        timeout: 15000,
      },
    );

  revalidatePath("/purchases");
  revalidatePath("/banking");
  revalidatePath("/accounting");
  revalidatePath("/reports");

  redirect("/purchases");
}