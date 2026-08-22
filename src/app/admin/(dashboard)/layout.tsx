import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifySessionToken } from "@/lib/authService";
import AdminLayoutClient from "./AdminLayoutClient";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session")?.value;

  if (!sessionCookie || !verifySessionToken(sessionCookie)) {
    redirect("/admin/login");
  }

  const [adminUserId] = sessionCookie.split(".");
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
  });

  if (!admin || admin.deletedAt !== null) {
    redirect("/admin/login");
  }

  // Role authorization check: Only ADMIN or SUPERADMIN can access
  if (admin.role !== "ADMIN" && admin.role !== "SUPERADMIN") {
    return (
      <AdminLayoutClient 
        admin={{
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        }} 
        denied={true}
      >
        {null}
      </AdminLayoutClient>
    );
  }

  return (
    <AdminLayoutClient 
      admin={{
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      }}
      denied={false}
    >
      {children}
    </AdminLayoutClient>
  );
}
