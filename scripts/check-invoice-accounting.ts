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

async function main() {
  const firm = await prisma.firm.findFirst({
    where: {
      name: "Maphorogo Attorneys",
    },
  });

  if (!firm) {
    throw new Error("Maphorogo Attorneys was not found.");
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      firmId: firm.id,
      invoiceNumber: "INV-0003",
    },
    include: {
      client: true,
      matter: true,
    },
  });

  if (!invoice) {
    console.log("INV-0003 was not found.");
    return;
  }

  console.log("INVOICE");
  console.log("-------");
  console.log(`Number:   ${invoice.invoiceNumber}`);
  console.log(`Client:   ${invoice.client.displayName}`);
  console.log(`Subtotal: R${Number(invoice.subtotal).toFixed(2)}`);
  console.log(`VAT:      R${Number(invoice.taxAmount).toFixed(2)}`);
  console.log(`Total:    R${Number(invoice.total).toFixed(2)}`);
  console.log(`Paid:     R${Number(invoice.amountPaid).toFixed(2)}`);
  console.log(`Balance:  R${Number(invoice.balanceDue).toFixed(2)}`);
  console.log(`Status:   ${invoice.status}`);

  const entries = await prisma.journalEntry.findMany({
    where: {
      firmId: firm.id,
      sourceType: "INVOICE",
      sourceId: invoice.id,
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

  console.log("");
  console.log("JOURNAL ENTRIES");
  console.log("----------------");

  if (entries.length === 0) {
    console.log("No journal entries found.");
    return;
  }

  for (const entry of entries) {
    console.log("");
    console.log(`Description: ${entry.description}`);
    console.log(`Source: ${entry.sourceType}`);
    console.log("");

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of entry.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);

      totalDebit += debit;
      totalCredit += credit;

      console.log(
        `${line.ledgerAccount.code} - ${line.ledgerAccount.name} | Debit R${debit.toFixed(2)} | Credit R${credit.toFixed(2)}`
      );
    }

    console.log("");
    console.log(`Total Debit:  R${totalDebit.toFixed(2)}`);
    console.log(`Total Credit: R${totalCredit.toFixed(2)}`);
    console.log(
      `Balanced: ${Math.abs(totalDebit - totalCredit) < 0.01 ? "YES" : "NO"}`
    );
  }
}

main()
  .catch((error) => {
    console.error("CHECK ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });