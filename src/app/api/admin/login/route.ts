import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signSessionToken, hashPassword } from "@/lib/authService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Correo y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Auto-seed default admin user if database is empty
    const count = await prisma.adminUser.count();
    if (count === 0) {
      console.log("[Login API] Creando usuario administrador por defecto: admin@udg.com");
      await prisma.adminUser.create({
        data: {
          email: "admin@udg.com",
          name: "Oficial de Cumplimiento UDG",
          passwordHash: hashPassword("admin123"),
          role: "SUPERADMIN",
        },
      });
    }

    // Find user in database
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!adminUser || adminUser.deletedAt !== null) {
      return NextResponse.json(
        { success: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, adminUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Generate cryptographic admin session token
    const token = signSessionToken(adminUser.id);

    // Create the response
    const response = NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
    });

    // Set cookie: HttpOnly, Secure, SameSite=Lax, age 7 days
    response.cookies.set({
      name: "admin_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error("[Login API Error]:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor al procesar el login" },
      { status: 500 }
    );
  }
}
