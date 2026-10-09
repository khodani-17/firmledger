import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const TEST_INVOICES = [
  "INV-0001",
  "INV-0002",
  ];

async function main() {
  const firm = await prisma.firm.findFirst({
    where: {
      name: "Maphorogo Attorneys",
    },
  });

  if (!firm) {
    throw new Error("Maphorogo Attorneys was not found.");
  }

  console.log(`Firm: ${firm.name}`);
  console.log("");

  const invoices = await prisma.invoice.findMany({
    where: {
      firmId: firm.id,
      invoiceNumber: {
        in: TEST_INVOICES,
      },
    },
    select: {
      id: true,
      invoiceNumber: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      balanceDue: true,
    },
    orderBy: {
      invoiceNumber: "asc",
    },
  });

  if (invoices.length === 0) {
    console.log("No matching test invoices found.");
    return;
  }

  console.log("Invoices that will be removed:");

  for (const invoice of invoices) {
    console.log(
      `- ${invoice.invoiceNumber}: R${Number(invoice.total).toFixed(2)}`,
    );
  }

  console.log("");

  const invoiceIds = invoices.map((invoice) => invoice.id);

  /*
   * Safety check:
   * Do not silently delete invoices that already have payments
   * or credit notes attached to them.
   */
  const payments = await prisma.payment.findMany({
    where: {
      firmId: firm.id,
      invoiceId: {
        in: invoiceIds,
      },
    },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      reference: true,
    },
  });

  if (payments.length > 0) {
    console.error(
      "STOP: One or more test invoices already have payments.",
    );

    for (const payment of payments) {
      console.error(
        `Payment ${payment.id}: R${Number(payment.amount).toFixed(2)} (${payment.reference ?? "no reference"})`,
      );
    }

    console.error("No invoices were deleted.");

    return;
  }

  const creditNotes = await prisma.creditNote.findMany({
    where: {
      firmId: firm.id,
      invoiceId: {
        in: invoiceIds,
      },
    },
    select: {
      id: true,
      creditNumber: true,
      invoiceId: true,
    },
  });

  if (creditNotes.length > 0) {
    console.error(
      "STOP: One or more test invoices already have credit notes.",
    );

    for (const note of creditNotes) {
      console.error(`Credit note ${note.creditNumber}`);
    }

    console.error("No invoices were deleted.");

    return;
  }

  /*
   * Use a longer transaction timeout because this cleanup performs
   * several database operations before committing.
   */
  await prisma.$transaction(
    async (tx) => {
      /*
       * 1. Delete journal entries created by the invoices.
       *
       * JournalEntry -> JournalLine has onDelete: Cascade,
       * so deleting the journal entry also deletes its lines.
       */
      const journalEntries = await tx.journalEntry.findMany({
        where: {
          firmId: firm.id,
          sourceType: "INVOICE",
          sourceId: {
            in: invoiceIds,
          },
        },
        select: {
          id: true,
          sourceId: true,
        },
      });

      for (const entry of journalEntries) {
        await tx.journalEntry.delete({
          where: {
            id: entry.id,
          },
        });
      }

      console.log(
        `Deleted ${journalEntries.length} invoice journal entr${
          journalEntries.length === 1 ? "y" : "ies"
        }.`,
      );

      /*
       * 2. Delete accountant review records created by createInvoice().
       *
       * createInvoice() creates:
       * "Review invoice INV-XXXX"
       */
      const reviews = await tx.accountantReview.findMany({
        where: {
          firmId: firm.id,
          title: {
            in: invoices.map(
              (invoice) =>
                `Review invoice ${invoice.invoiceNumber}`,
            ),
          },
        },
        select: {
          id: true,
          title: true,
        },
      });

      for (const review of reviews) {
        await tx.accountantReview.delete({
          where: {
            id: review.id,
          },
        });
      }

      console.log(
        `Deleted ${reviews.length} accountant review record${
          reviews.length === 1 ? "" : "s"
        }.`,
      );

      /*
       * 3. Delete audit records created for these invoices.
       */
      const auditLogs = await tx.auditLog.findMany({
        where: {
          firmId: firm.id,
          entity: "Invoice",
          entityId: {
            in: invoiceIds,
          },
        },
        select: {
          id: true,
        },
      });

      for (const log of auditLogs) {
        await tx.auditLog.delete({
          where: {
            id: log.id,
          },
        });
      }

      console.log(
        `Deleted ${auditLogs.length} invoice audit log${
          auditLogs.length === 1 ? "" : "s"
        }.`,
      );

      /*
       * 4. Delete the invoices.
       *
       * InvoiceItem records are automatically deleted because:
       *
       * InvoiceItem.invoice -> Invoice
       * onDelete: Cascade
       */
      for (const invoice of invoices) {
        await tx.invoice.delete({
          where: {
            id: invoice.id,
          },
        });
      }

      console.log(
        `Deleted ${invoices.length} test invoice${
          invoices.length === 1 ? "" : "s"
        }.`,
      );
    },
    {
      maxWait: 10000,
      timeout: 30000,
    },
  );

  console.log("");
  console.log("Cleanup completed successfully.");
  console.log("");

  console.log("Remaining test invoices:");

  const remaining = await prisma.invoice.findMany({
    where: {
      firmId: firm.id,
      invoiceNumber: {
        in: TEST_INVOICES,
      },
    },
    select: {
      invoiceNumber: true,
    },
  });

  if (remaining.length === 0) {
    console.log("None.");
  } else {
    for (const invoice of remaining) {
      console.log(`- ${invoice.invoiceNumber}`);
    }
  }

  console.log("");
  console.log("INV-0004 and INV-0005 were not touched.");
}

main()
  .catch((error) => {
    console.error("CLEANUP ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });