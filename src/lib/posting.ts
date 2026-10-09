import { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;

type JournalLineInput = {
  ledgerAccountId: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  description?: string;
};

type EntryArgs = {
  firmId: string;
  date: Date;
  description: string;
  sourceType: string;
  sourceId: string;
  lines: JournalLineInput[];
};

function decimal(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value);
}

function assertValidAmount(
  value: Prisma.Decimal,
  field: string
) {
  if (!value.isFinite() || value.isNegative()) {
    throw new Error(`Invalid accounting amount for ${field}.`);
  }
}

function assertBalanced(lines: JournalLineInput[]) {
  if (lines.length === 0) {
    throw new Error(
      "Journal entry must contain at least one line."
    );
  }

  let debit = new Prisma.Decimal(0);
  let credit = new Prisma.Decimal(0);

  for (const line of lines) {
    assertValidAmount(line.debit, "debit");
    assertValidAmount(line.credit, "credit");

    const hasDebit = !line.debit.isZero();
    const hasCredit = !line.credit.isZero();

    if (hasDebit && hasCredit) {
      throw new Error(
        "A journal line cannot contain both a debit and a credit."
      );
    }

    if (!hasDebit && !hasCredit) {
      throw new Error(
        "A journal line must contain either a debit or a credit."
      );
    }

    debit = debit.plus(line.debit);
    credit = credit.plus(line.credit);
  }

  if (!debit.equals(credit)) {
    throw new Error(
      `Journal entry is not balanced. Debit: ${debit.toFixed(
        2
      )}, Credit: ${credit.toFixed(2)}.`
    );
  }
}

async function account(
  db: Db,
  firmId: string,
  code: string,
  expectedType:
    | "ASSET"
    | "LIABILITY"
    | "EQUITY"
    | "REVENUE"
    | "EXPENSE"
) {
  const result = await db.ledgerAccount.findFirst({
    where: {
      firmId,
      code,
      active: true,
    },
  });

  if (!result) {
    throw new Error(
      `Ledger account ${code} is not configured for this firm.`
    );
  }

  if (result.accountType !== expectedType) {
    throw new Error(
      `Ledger account ${code} must be ${expectedType}, but is configured as ${result.accountType}.`
    );
  }

  return result;
}

/**
 * Finds the OPEN financial period containing the posting date.
 *
 * This function is exported so transaction actions can use the
 * exact same period-resolution logic as journal posting.
 */
export async function getOpenPeriod(
  db: Db,
  firmId: string,
  date: Date
) {
  const period = await db.financialPeriod.findFirst({
    where: {
      firmId,
      startDate: {
        lte: date,
      },
      endDate: {
        gte: date,
      },
      status: "OPEN",
    },
    orderBy: {
      startDate: "desc",
    },
  });

  if (!period) {
    const lockedOrClosed =
      await db.financialPeriod.findFirst({
        where: {
          firmId,
          startDate: {
            lte: date,
          },
          endDate: {
            gte: date,
          },
          status: {
            in: ["CLOSED", "LOCKED"],
          },
        },
      });

    if (lockedOrClosed) {
      throw new Error(
        `The financial period containing ${date
          .toISOString()
          .slice(
            0,
            10
          )} is ${lockedOrClosed.status.toLowerCase()} and cannot accept new postings.`
      );
    }

    throw new Error(
      `No open financial period exists for ${date
        .toISOString()
        .slice(0, 10)}.`
    );
  }

  return period;
}

async function entry(
  db: Db,
  args: EntryArgs
) {
  assertBalanced(args.lines);

  const period = await getOpenPeriod(
    db,
    args.firmId,
    args.date
  );

  const existing =
    await db.journalEntry.findFirst({
      where: {
        firmId: args.firmId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    throw new Error(
      `Accounting entry already exists for ${args.sourceType}:${args.sourceId}.`
    );
  }

  const accounts =
    await db.ledgerAccount.findMany({
      where: {
        id: {
          in: args.lines.map(
            (line) => line.ledgerAccountId
          ),
        },
        firmId: args.firmId,
        active: true,
      },
      select: {
        id: true,
      },
    });

  if (accounts.length !== args.lines.length) {
    throw new Error(
      "One or more journal accounts do not belong to this firm or are inactive."
    );
  }

  return db.journalEntry.create({
    data: {
      firmId: args.firmId,
      periodId: period.id,
      entryDate: args.date,
      description: args.description,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      lines: {
        create: args.lines.map((line) => ({
          ledgerAccountId:
            line.ledgerAccountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
        })),
      },
    },
  });
}

export async function postInvoice(
  db: Db,
  a: {
    firmId: string;
    invoiceId: string;
    invoiceNumber: string;
    entryDate: Date;
    subtotal: number;
    taxAmount: number;
  }
) {
  const subtotal = decimal(a.subtotal);
  const taxAmount = decimal(a.taxAmount);
  const total = subtotal.plus(taxAmount);

  assertValidAmount(
    subtotal,
    "invoice subtotal"
  );
  assertValidAmount(
    taxAmount,
    "invoice tax"
  );
  assertValidAmount(
    total,
    "invoice total"
  );

  const ar = await account(
    db,
    a.firmId,
    "1100",
    "ASSET"
  );

  const revenue = await account(
    db,
    a.firmId,
    "4000",
    "REVENUE"
  );

  const vat = await account(
    db,
    a.firmId,
    "2000",
    "LIABILITY"
  );

  return entry(db, {
    firmId: a.firmId,
    date: a.entryDate,
    description: `Invoice ${a.invoiceNumber}`,
    sourceType: "INVOICE",
    sourceId: a.invoiceId,
    lines: [
      {
        ledgerAccountId: ar.id,
        debit: total,
        credit: decimal(0),
        description: a.invoiceNumber,
      },
      {
        ledgerAccountId: revenue.id,
        debit: decimal(0),
        credit: subtotal,
        description: a.invoiceNumber,
      },
      ...(taxAmount.isZero()
        ? []
        : [
            {
              ledgerAccountId: vat.id,
              debit: decimal(0),
              credit: taxAmount,
              description: a.invoiceNumber,
            },
          ]),
    ],
  });
}

export async function postPayment(
  db: Db,
  a: {
    firmId: string;
    paymentId: string;
    reference: string;
    entryDate: Date;
    amount: number;
  }
) {
  const amount = decimal(a.amount);

  assertValidAmount(
    amount,
    "payment"
  );

  if (amount.isZero()) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  const bank = await account(
    db,
    a.firmId,
    "1000",
    "ASSET"
  );

  const ar = await account(
    db,
    a.firmId,
    "1100",
    "ASSET"
  );

  return entry(db, {
    firmId: a.firmId,
    date: a.entryDate,
    description: `Payment ${a.reference}`,
    sourceType: "PAYMENT",
    sourceId: a.paymentId,
    lines: [
      {
        ledgerAccountId: bank.id,
        debit: amount,
        credit: decimal(0),
        description: a.reference,
      },
      {
        ledgerAccountId: ar.id,
        debit: decimal(0),
        credit: amount,
        description: a.reference,
      },
    ],
  });
}

export async function postExpense(
  db: Db,
  a: {
    firmId: string;
    expenseId: string;
    description: string;
    entryDate: Date;
    netAmount: number;
    taxAmount: number;
  }
) {
  const netAmount = decimal(a.netAmount);
  const taxAmount = decimal(a.taxAmount);
  const total = netAmount.plus(taxAmount);

  assertValidAmount(
    netAmount,
    "expense net amount"
  );
  assertValidAmount(
    taxAmount,
    "expense tax"
  );
  assertValidAmount(
    total,
    "expense total"
  );

  if (total.isZero()) {
    throw new Error(
      "Expense amount must be greater than zero."
    );
  }

  const expense = await account(
    db,
    a.firmId,
    "5000",
    "EXPENSE"
  );

  const vat = await account(
    db,
    a.firmId,
    "2100",
    "ASSET"
  );

  const bank = await account(
    db,
    a.firmId,
    "1000",
    "ASSET"
  );

  return entry(db, {
    firmId: a.firmId,
    date: a.entryDate,
    description: `Expense ${a.description}`,
    sourceType: "EXPENSE",
    sourceId: a.expenseId,
    lines: [
      {
        ledgerAccountId: expense.id,
        debit: netAmount,
        credit: decimal(0),
        description: a.description,
      },
      ...(taxAmount.isZero()
        ? []
        : [
            {
              ledgerAccountId: vat.id,
              debit: taxAmount,
              credit: decimal(0),
              description: `Input VAT - ${a.description}`,
            },
          ]),
      {
        ledgerAccountId: bank.id,
        debit: decimal(0),
        credit: total,
        description: a.description,
      },
    ],
  });
}

export async function postPurchaseInvoice(
  db: Db,
  a: {
    firmId: string;
    id: string;
    description: string;
    date: Date;
    net: number;
    tax: number;
  }
) {
  const net = decimal(a.net);
  const tax = decimal(a.tax);
  const total = net.plus(tax);

  assertValidAmount(
    net,
    "purchase invoice net"
  );
  assertValidAmount(
    tax,
    "purchase invoice tax"
  );
  assertValidAmount(
    total,
    "purchase invoice total"
  );

  if (total.isZero()) {
    throw new Error(
      "Purchase invoice amount must be greater than zero."
    );
  }

  const expense = await account(
    db,
    a.firmId,
    "5000",
    "EXPENSE"
  );

  const vat = await account(
    db,
    a.firmId,
    "2100",
    "ASSET"
  );

  const ap = await account(
    db,
    a.firmId,
    "2200",
    "LIABILITY"
  );

  return entry(db, {
    firmId: a.firmId,
    date: a.date,
    description: `Purchase invoice ${a.description}`,
    sourceType: "PURCHASE_INVOICE",
    sourceId: a.id,
    lines: [
      {
        ledgerAccountId: expense.id,
        debit: net,
        credit: decimal(0),
        description: a.description,
      },
      ...(tax.isZero()
        ? []
        : [
            {
              ledgerAccountId: vat.id,
              debit: tax,
              credit: decimal(0),
              description: `Input VAT - ${a.description}`,
            },
          ]),
      {
        ledgerAccountId: ap.id,
        debit: decimal(0),
        credit: total,
        description: a.description,
      },
    ],
  });
}

export async function postSupplierPayment(
  db: Db,
  a: {
    firmId: string;
    id: string;
    reference: string;
    date: Date;
    amount: number;
  }
) {
  const amount = decimal(a.amount);

  assertValidAmount(
    amount,
    "supplier payment"
  );

  if (amount.isZero()) {
    throw new Error(
      "Supplier payment amount must be greater than zero."
    );
  }

  const ap = await account(
    db,
    a.firmId,
    "2200",
    "LIABILITY"
  );

  const bank = await account(
    db,
    a.firmId,
    "1000",
    "ASSET"
  );

  return entry(db, {
    firmId: a.firmId,
    date: a.date,
    description: `Supplier payment ${a.reference}`,
    sourceType: "SUPPLIER_PAYMENT",
    sourceId: a.id,
    lines: [
      {
        ledgerAccountId: ap.id,
        debit: amount,
        credit: decimal(0),
        description: a.reference,
      },
      {
        ledgerAccountId: bank.id,
        debit: decimal(0),
        credit: amount,
        description: a.reference,
      },
    ],
  });
}