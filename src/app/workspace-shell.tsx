
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/app/logout-button";

type WorkspaceUser = {
  name: string;
  role: string;
  firm: {
    name: string;
  };
};

type WorkspaceShellProps = {
  user: WorkspaceUser;
  children: React.ReactNode;
};

const sections = [
  {
    title: "WORK",
    links: [
      { label: "Clients", href: "/clients" },
      { label: "Matters", href: "/matters" },
      { label: "Documents", href: "/documents" },
    ],
  },
  {
    title: "BILLING",
    links: [
      { label: "Invoices", href: "/billing" },
      { label: "Payments", href: "/payments" },
      { label: "Credit Notes", href: "/credit-notes" },
      { label: "Recurring", href: "/recurring" },
    ],
  },
  {
    title: "ACCOUNTING",
    links: [
      { label: "Overview", href: "/accounting" },
      { label: "General Ledger", href: "/accounting/general-ledger" },
      { label: "Trial Balance", href: "/accounting/trial-balance" },
      { label: "Profit & Loss", href: "/accounting/profit-loss" },
      { label: "Balance Sheet", href: "/accounting/balance-sheet" },
      { label: "Cash Flow", href: "/accounting/cash-flow" },
      { label: "Accounts Receivable", href: "/accounting/accounts-receivable" },
      { label: "Accounts Payable", href: "/accounting/accounts-payable" },
      { label: "Bank Reconciliation", href: "/accounting/bank-reconciliation" },
      { label: "Cash & Bank", href: "/accounting/cash-bank" },
      { label: "VAT / Tax", href: "/accounting/vat-tax" },
      { label: "Financial Periods", href: "/accounting/financial-periods" },
      { label: "Period Management", href: "/periods" },
    ],
  },
  {
    title: "BANKING",
    links: [
      { label: "Banking", href: "/banking" },
      { label: "Reconciliation", href: "/banking/reconciliation" },
    ],
  },
  {
    title: "PURCHASING",
    links: [
      { label: "Purchases", href: "/purchases" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Expenses", href: "/expenses" },
    ],
  },
  {
    title: "TRUST",
    links: [
      { label: "Trust", href: "/trust" },
      { label: "Reconciliation", href: "/trust/reconciliation" },
    ],
  },
  {
    title: "REPORTS",
    links: [{ label: "Reports", href: "/reports" }],
  },
  {
    title: "SYSTEM",
    links: [
      { label: "Settings", href: "/settings" },
      { label: "Audit", href: "/audit" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/accounting") {
    return pathname === "/accounting";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceShell({
  user,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          Firm<span>Ledger</span>
        </Link>

        <Link
          href="/"
          className={`nav-link ${pathname === "/" ? "active" : ""}`}
        >
          Overview
        </Link>

        {sections.map((section) => {
          const sectionActive = section.links.some((link) =>
            isActive(pathname, link.href)
          );

          return (
            <details
              key={section.title}
              className={`nav-dropdown ${
                section.title === "ACCOUNTING" ? "nav-dropdown-accounting" : ""
              }`}
              open={sectionActive}
            >
              <summary className="nav-section-toggle">
                <span>{section.title}</span>
                <span className="nav-chevron">▾</span>
              </summary>

              <div className="nav-dropdown-items">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link ${
                      isActive(pathname, link.href) ? "active" : ""
                    }`}
                    aria-current={
                      isActive(pathname, link.href) ? "page" : undefined
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
      </aside>

      <main className="main">
        <header className="topbar">
          <strong>{user.firm.name}</strong>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span className="metric-label">
              {user.name} · {user.role}
            </span>

            <LogoutButton />
          </div>
        </header>

        <section className="content">{children}</section>
      </main>
    </div>
  );
}