import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getLocalOrderAttachment } from "@/lib/local-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionUser())) return new NextResponse("No autorizado", { status: 401 });
  const { id } = await params;
  const attachment = await getLocalOrderAttachment(id);
  if (!attachment) return new NextResponse("No encontrado", { status: 404 });

  const bytes = await readFile(attachment.storagePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.fileType,
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
    },
  });
}
