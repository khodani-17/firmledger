import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: "INV-0003",
    },
    include: {
      client: true,
      payments: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          bankTransactions: {
            include: {
              bankAccount: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("INV-0003 was not found.");
  }

  console.log("INVOICE");
  console.log("-------");
  console.log(`Number:   ${invoice.invoiceNumber}`);
  console.log(`Client:   ${invoice.client.displayName}`);
  console.log(`Total:    R${Number(invoice.total).toFixed(2)}`);
  console.log(`Paid:     R${Number(invoice.amountPaid).toFixed(2)}`);
  console.log(`Balance:  R${Number(invoice.balanceDue).toFixed(2)}`);
  console.log(`Status:   ${invoice.status}`);

  console.log("");
  console.log("PAYMENTS");
  console.log("--------");

  if (invoice.payments.length === 0) {
    console.log("No payments found.");
    return;
  }

  for (const payment of invoice.payments) {
    console.log("");
    console.log(`Payment ID: ${payment.id}`);
    console.log(`Amount:     R${Number(payment.amount).toFixed(2)}`);
    console.log(`Reference:  ${payment.reference}`);
    console.log(`Method:     ${payment.method}`);
    console.log(`Status:     ${payment.status}`);

    console.log("");
    console.log("BANK TRANSACTIONS");
    console.log("-----------------");

    if (payment.bankTransactions.length === 0) {
      console.log("No bank transaction found.");
    }

    for (const transaction of payment.bankTransactions) {
      console.log(
        `Bank:        ${transaction.bankAccount.bankName ?? "Unknown"} — ${transaction.bankAccount.name}`,
      );

      console.log(
        `Type:        ${transaction.type}`,
      );

      console.log(
        `Amount:      R${Number(transaction.amount).toFixed(2)}`,
      );

      console.log(
        `Description: ${transaction.description ?? ""}`,
      );

      console.log(
        `Reference:   ${transaction.reference ?? ""}`,
      );

      console.log(
        `Matched:     ${transaction.matched ? "YES" : "NO"}`,
      );
    }
  }

  console.log("");
  console.log("PAYMENT JOURNAL ENTRIES");
  console.log("-----------------------");

  const paymentIds = invoice.payments.map(
    (payment) => payment.id,
  );

  const entries = await prisma.journalEntry.findMany({
    where: {
      sourceType: "PAYMENT",
      sourceId: {
        in: paymentIds,
      },
    },
    include: {
      lines: {
        include: {
          ledgerAccount: true,
        },
      },
    },
    orderBy: {
      entryDate: "asc",
    },
  });

  if (entries.length === 0) {
    console.log("No payment journal entries found.");
    return;
  }

  for (const entry of entries) {
    console.log("");
    console.log(`Description: ${entry.description}`);
    console.log(`Source: ${entry.sourceType}`);

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of entry.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      totalDebit += debit;
      totalCredit += credit;

      console.log(
        `${line.ledgerAccount.code} - ${line.ledgerAccount.name} | Debit R${debit.toFixed(2)} | Credit R${credit.toFixed(2)}`,
      );
    }

    console.log("");
    console.log(
      `Total Debit:  R${totalDebit.toFixed(2)}`,
    );

    console.log(
      `Total Credit: R${totalCredit.toFixed(2)}`,
    );

    console.log(
      `Balanced: ${
        Math.abs(totalDebit - totalCredit) < 0.005
          ? "YES"
          : "NO"
      }`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });