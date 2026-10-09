import { requireRole } from "@/lib/permissions";

export default async function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole([
    "OWNER",
    "ADMIN",
    "FINANCE",
    "LAWYER",
    "STAFF",
  ]);

  return <>{children}</>;
}