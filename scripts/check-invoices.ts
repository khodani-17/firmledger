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

  const invoices = await prisma.invoice.findMany({
    where: {
      firmId: firm.id,
    },
    orderBy: {
      invoiceNumber: "asc",
    },
    select: {
      invoiceNumber: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      amountPaid: true,
      balanceDue: true,
      status: true,
    },
  });

  console.log(`Firm: ${firm.name}`);
  console.log("");
  console.log("Current invoices:");

  if (invoices.length === 0) {
    console.log("No invoices found.");
  } else {
    for (const invoice of invoices) {
      console.log(
        `- ${invoice.invoiceNumber}: subtotal R${invoice.subtotal.toFixed(2)}, VAT R${invoice.taxAmount.toFixed(2)}, total R${invoice.total.toFixed(2)}, paid R${invoice.amountPaid.toFixed(2)}, balance R${invoice.balanceDue.toFixed(2)}, status ${invoice.status}`
      );
    }
  }

  const testInvoices = await prisma.invoice.count({
    where: {
      firmId: firm.id,
      invoiceNumber: {
        in: ["INV-0001", "INV-0002", "INV-0003"],
      },
    },
  });

  console.log("");
  console.log(
    `INV-0001 to INV-0003 still in database: ${testInvoices}`
  );
}

main()
  .catch((error) => {
    console.error("CHECK ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });