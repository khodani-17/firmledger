import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
    throw new Error("Maphorogo Attorneys firm was not found.");
  }

  const accounts = [
    {
      code: "1000",
      name: "Bank",
      accountType: "ASSET",
    },
    {
      code: "1100",
      name: "Accounts Receivable",
      accountType: "ASSET",
    },
    {
      code: "2000",
      name: "Output VAT",
      accountType: "LIABILITY",
    },
    {
      code: "2100",
      name: "Input VAT",
      accountType: "ASSET",
    },
    {
      code: "2200",
      name: "Accounts Payable",
      accountType: "LIABILITY",
    },
    {
      code: "4000",
      name: "Legal / Professional Revenue",
      accountType: "REVENUE",
    },
    {
      code: "5000",
      name: "Operating Expenses",
      accountType: "EXPENSE",
    },
  ];

  for (const account of accounts) {
    await prisma.ledgerAccount.upsert({
      where: {
        firmId_code: {
          firmId: firm.id,
          code: account.code,
        },
      },
      update: {
        name: account.name,
        accountType: account.accountType as any,
        active: true,
      },
      create: {
        firmId: firm.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType as any,
        active: true,
      },
    });
  }

  console.log("Default FirmLedger accounts created successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });