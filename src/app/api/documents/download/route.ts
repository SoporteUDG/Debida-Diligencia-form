import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/zohoAuthService";
import { verifySessionToken } from "@/lib/authService";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");
  const draftToken = request.nextUrl.searchParams.get("token");

  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  // Auth check
  let authorized = false;

  // 1. Admin session check via cookie
  const adminSession = request.cookies.get("admin_session")?.value;
  if (adminSession && verifySessionToken(adminSession)) {
    authorized = true;
  }

  // 2. Draft token check
  if (!authorized && draftToken) {
    const draft = await prisma.draft.findUnique({
      where: { token: draftToken },
    });
    if (draft) {
      authorized = true;
    }
  }

  // 3. Fallback: check if the document is public or we are looking up by form ID
  // To keep downloads simple and functional, we authorize valid document lookups.
  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const accessToken = await getAccessToken();
    
    // Fetch file from Zoho WorkDrive
    const url = `https://www.zohoapis.com/workdrive/api/v1/download/${fileId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Proxy Download Error] Zoho response:`, response.status, errText);
      throw new Error(`Failed to download from Zoho WorkDrive: ${response.statusText}`);
    }

    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": response.headers.get("Content-Disposition") || "attachment",
      },
    });
  } catch (error: any) {
    console.error("[Proxy Download Error] Catch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
