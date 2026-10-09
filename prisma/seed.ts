import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth";
import { postInvoice } from "../src/lib/posting";

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
  await prisma.auditLog.deleteMany();
  await prisma.accountantReview.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.recurringInvoice.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.trustTransaction.deleteMany();
  await prisma.trustReconciliation.deleteMany();
  await prisma.trustAccount.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.matter.deleteMany();
  await prisma.client.deleteMany();
  await prisma.taxReturn.deleteMany();
  await prisma.financialPeriod.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.firmUser.deleteMany();
  await prisma.firm.deleteMany();

  const password = await hashPassword("ChangeMe123!");

  const firm = await prisma.firm.create({
    data: {
      name: "Maphorogo Attorneys",
      registrationNumber: "TEST-FIRM-001",
      vatNumber: "4123456789",
      currency: "ZAR",

      users: {
        create: [
          {
            name: "Firm Owner",
            email: "owner@example.com",
            passwordHash: password,
            role: "OWNER",
          },
          {
            name: "Finance User",
            email: "finance@example.com",
            passwordHash: password,
            role: "FINANCE",
          },
          {
            name: "Accountant",
            email: "accountant@example.com",
            passwordHash: password,
            role: "ACCOUNTANT",
          },
          {
            name: "Attorney",
            email: "lawyer@example.com",
            passwordHash: password,
            role: "LAWYER",
          },
        ],
      },

      taxRates: {
        create: [
          {
            name: "VAT 15%",
            rate: 15,
            code: "VAT15",
          },
          {
            name: "Zero Rated",
            rate: 0,
            code: "ZERO",
          },
        ],
      },

      ledgerAccounts: {
        create: [
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
            name: "VAT Output Control",
            accountType: "LIABILITY",
          },
          {
            code: "2100",
            name: "VAT Input Control",
            accountType: "ASSET",
          },
          {
            code: "2200",
            name: "Accounts Payable",
            accountType: "LIABILITY",
          },
          {
            code: "4000",
            name: "Legal Fees",
            accountType: "REVENUE",
          },
          {
            code: "4100",
            name: "Disbursement Recovery",
            accountType: "REVENUE",
          },
          {
            code: "5000",
            name: "Operating Expenses",
            accountType: "EXPENSE",
          },
        ],
      },
    },
  });

  const bank = await prisma.bankAccount.create({
    data: {
      firmId: firm.id,
      name: "Business Current Account",
      bankName: "Demo Bank",
      accountNumber: "****1234",
    },
  });

  const client = await prisma.client.create({
    data: {
      firmId: firm.id,
      clientCode: "CL-0001",
      displayName: "Demo Client",
      email: "client@example.com",
      type: "INDIVIDUAL",
    },
  });

  const matter = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId: client.id,
      matterNumber: "MAT-2026-0001",
      title: "Demo Civil Matter",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      firmId: firm.id,
      clientId: client.id,
      matterId: matter.id,
      invoiceNumber: "INV-0001",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      status: "SENT",
      subtotal: 10000,
      taxAmount: 1500,
      total: 11500,
      amountPaid: 0,
      balanceDue: 11500,

      items: {
        create: [
          {
            description: "Professional legal services",
            quantity: 1,
            unitPrice: 10000,
            taxRate: 15,
            lineTotal: 10000,
          },
        ],
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await postInvoice(tx, {
      firmId: firm.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      entryDate: invoice.issueDate,
      subtotal: 10000,
      taxAmount: 1500,
    });

    await tx.accountantReview.create({
      data: {
        firmId: firm.id,
        title: `Review invoice ${invoice.invoiceNumber}`,
        status: "PENDING",
        notes: "Demo invoice awaiting accountant review.",
      },
    });
  });

  const supplier = await prisma.supplier.create({
    data: {
      firmId: firm.id,
      supplierCode: "SUP-0001",
      name: "Demo Office Supplies",
      vatNumber: "4000000000",
    },
  });

  const purchase = await prisma.purchaseInvoice.create({
    data: {
      firmId: firm.id,
      supplierId: supplier.id,
      invoiceNumber: "SUP-INV-001",
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      status: "RECEIVED",
      subtotal: 1000,
      taxAmount: 150,
      total: 1150,
      amountPaid: 0,
      balanceDue: 1150,
      description: "Office supplies",
    },
  });

  await prisma.$transaction(async (tx) => {
    const expense = await tx.ledgerAccount.findFirstOrThrow({
      where: {
        firmId: firm.id,
        code: "5000",
      },
    });

    const vat = await tx.ledgerAccount.findFirstOrThrow({
      where: {
        firmId: firm.id,
        code: "2100",
      },
    });

    const ap = await tx.ledgerAccount.findFirstOrThrow({
      where: {
        firmId: firm.id,
        code: "2200",
      },
    });

    await tx.journalEntry.create({
      data: {
        firmId: firm.id,
        entryDate: purchase.invoiceDate,
        description: `Purchase invoice ${purchase.invoiceNumber}`,
        sourceType: "PURCHASE_INVOICE",
        sourceId: purchase.id,

        lines: {
          create: [
            {
              ledgerAccountId: expense.id,
              debit: 1000,
              credit: 0,
            },
            {
              ledgerAccountId: vat.id,
              debit: 150,
              credit: 0,
            },
            {
              ledgerAccountId: ap.id,
              debit: 0,
              credit: 1150,
            },
          ],
        },
      },
    });
  });

  const trust = await prisma.trustAccount.create({
    data: {
      firmId: firm.id,
      name: "Client Trust Account",
      bankName: "Demo Bank",
      accountNumber: "****5678",
    },
  });

  const financeUser = await prisma.firmUser.findFirstOrThrow({
    where: {
      firmId: firm.id,
      role: "FINANCE",
    },
  });

  await prisma.trustTransaction.create({
    data: {
      firmId: firm.id,
      trustAccountId: trust.id,
      clientId: client.id,
      matterId: matter.id,
      type: "RECEIPT",
      status: "POSTED",
      transactionDate: new Date(),
      reference: "TRUST-001",
      description: "Initial client trust deposit",
      amount: 25000,
      createdById: financeUser.id,
    },
  });

  await prisma.financialPeriod.create({
    data: {
      firmId: firm.id,
      name: "September 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
    },
  });

  await prisma.recurringInvoice.create({
    data: {
      firmId: firm.id,
      clientId: client.id,
      matterId: matter.id,
      description: "Monthly retainer",
      subtotal: 5000,
      taxRate: 15,
      frequency: "MONTHLY",
      nextRunDate: new Date("2026-10-01"),
    },
  });

  console.log(`Seeded FirmLedger demo firm: ${firm.id}`);
  console.log("Development password: ChangeMe123!");
  console.log(`Business bank: ${bank.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });