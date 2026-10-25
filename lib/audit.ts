import { prisma } from "./db";
export async function audit(by: { id: string; name: string } | null, action: string, targetId: string | null, text: string, detail?: unknown) {
  try {
    await prisma.auditLog.create({ data: { byId: by?.id ?? null, byName: by?.name ?? "", action, targetId, text: text.slice(0, 500), detail: (detail ?? undefined) as any } });
  } catch (e) { console.error("audit", e); }
}
