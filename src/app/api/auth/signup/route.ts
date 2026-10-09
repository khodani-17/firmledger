import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { hashPassword, makeSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

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

const DEFAULT_ACCOUNTS = [
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const firmName = String(body.firmName || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!firmName) {
      return NextResponse.json(
        {
          error: "Firm name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error: "Full name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          error: "Password is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters long.",
        },
        {
          status: 400,
        },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          error: "Passwords do not match.",
        },
        {
          status: 400,
        },
      );
    }

    const existingFirm = await prisma.firm.findFirst({
      where: {
        name: firmName,
      },
    });

    if (existingFirm) {
      return NextResponse.json(
        {
          error: "A firm with this name already exists.",
        },
        {
          status: 409,
        },
      );
    }

    const existingUser = await prisma.firmUser.findFirst({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email address already exists.",
        },
        {
          status: 409,
        },
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const firm = await tx.firm.create({
        data: {
          name: firmName,
        },
      });

      const user = await tx.firmUser.create({
        data: {
          firmId: firm.id,
          name,
          email,
          passwordHash,
          role: "OWNER",
        },
      });

      for (const account of DEFAULT_ACCOUNTS) {
        await tx.ledgerAccount.create({
          data: {
            firmId: firm.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType as any,
            active: true,
          },
        });
      }

      return {
        firm,
        user,
      };
    });

    const session = makeSession(result.user.id);

    const response = NextResponse.json(
      {
        success: true,
        message: "FirmLedger account created successfully.",
        firmId: result.firm.id,
        userId: result.user.id,
      },
      {
        status: 201,
      },
    );

    response.cookies.set({
      name: SESSION_COOKIE,
      value: session,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to create the FirmLedger account.",
      },
      {
        status: 500,
      },
    );
  } finally {
    await prisma.$disconnect();
  }
}