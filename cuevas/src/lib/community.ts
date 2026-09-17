import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { SEED_REPORTS } from "@/data/seed";
import { pointInArea } from "@/lib/geo";
import { REPORT_TYPE_MAP, type Report, type ReportTypeId } from "@/lib/report-types";

export const ADMIN_EMAIL = "bardohmo@gmail.com";

export type MemberStatus = "pending" | "approved" | "rejected";
export type MemberRole = "neighbor" | "admin";

export type Membership = {
  userId: string;
  email: string;
  displayName: string;
  status: MemberStatus;
  role: MemberRole;
  pendingCount: number;
};

export type MemberRow = {
  userId: string;
  email: string;
  displayName: string;
  status: MemberStatus;
  role: MemberRole;
  createdAt: number;
};

type UserRow = { email: string; name: string };
type MemberDb = {
  user_id: string;
  email: string;
  display_name: string;
  status: string;
  role: string;
};
type ReportDb = {
  id: string;
  user_id: string;
  type: string;
  lat: number;
  lng: number;
  note: string;
  author: string;
  created_at: string | Date;
};

function toMember(row: MemberDb, pendingCount = 0): Membership {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status as MemberStatus,
    role: row.role as MemberRole,
    pendingCount,
  };
}

function toReport(row: ReportDb): Report {
  return {
    id: row.id,
    type: row.type as ReportTypeId,
    lat: Number(row.lat),
    lng: Number(row.lng),
    note: row.note,
    author: row.author,
    createdAt: new Date(row.created_at).getTime(),
    userId: row.user_id,
  };
}

async function requireMember(userId: string): Promise<MemberDb> {
  const sql = await getSql();
  const rows = await sql<MemberDb>`
    select user_id, email, display_name, status, role
    from members
    where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Unauthorized");
  return row;
}

async function seedReportsIfEmpty(sql: Awaited<ReturnType<typeof getSql>>) {
  const count = await sql<{ n: number }>`select count(*)::int as n from reports`;
  if ((count[0]?.n ?? 0) > 0) return;
  for (const report of SEED_REPORTS) {
    await sql`
      insert into reports (id, user_id, type, lat, lng, note, author, created_at)
      values (
        ${report.id},
        ${"seed"},
        ${report.type},
        ${report.lat},
        ${report.lng},
        ${report.note},
        ${report.author},
        ${new Date(report.createdAt).toISOString()}
      )
    `;
  }
}

export const getMembership = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const users = await sql<UserRow>`
      select email, name from "user" where id = ${context.userId}
    `;
    const email = (users[0]?.email ?? "").trim().toLowerCase();
    const displayName = (users[0]?.name ?? "").trim() || email.split("@")[0] || "Vecino";
    const { isWorkspacePreview } = await import("@/lib/env.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const { GATE_IDENTITY_HEADER } = await import("@/lib/auth/gate-identity.server");
    const req = getRequest();
    const gateViewer = Boolean(
      req?.headers.get(GATE_IDENTITY_HEADER) ||
        req?.headers.get("cookie")?.includes("grok_gate_session"),
    );
    const previewOwner = isWorkspacePreview() && gateViewer;
    const isAdminEmail = email === ADMIN_EMAIL;
    const role: MemberRole = isAdminEmail || previewOwner ? "admin" : "neighbor";
    const status: MemberStatus = isAdminEmail || previewOwner ? "approved" : "pending";

    const existing = await sql<MemberDb>`
      select user_id, email, display_name, status, role
      from members
      where user_id = ${context.userId}
    `;

    if (!existing[0]) {
      await sql`
        insert into members (user_id, email, display_name, status, role, approved_at)
        values (
          ${context.userId},
          ${email || `${context.userId}@cuevas.local`},
          ${displayName},
          ${status},
          ${role},
          ${status === "approved" ? new Date().toISOString() : null}
        )
      `;
    } else if (isAdminEmail && (existing[0].role !== "admin" || existing[0].status !== "approved")) {
      await sql`
        update members
        set email = ${email},
            display_name = ${displayName},
            status = 'approved',
            role = 'admin',
            approved_at = now()
        where user_id = ${context.userId}
      `;
    } else if (displayName && displayName !== existing[0].display_name) {
      await sql`
        update members set display_name = ${displayName}, email = ${email || existing[0].email}
        where user_id = ${context.userId}
      `;
    }

    const row = (
      await sql<MemberDb>`
        select user_id, email, display_name, status, role
        from members
        where user_id = ${context.userId}
      `
    )[0];

    const pending = await sql<{ n: number }>`
      select count(*)::int as n from members where status = 'pending'
    `;

    await seedReportsIfEmpty(sql);
    if (!row) throw new Error("No se pudo crear la membresía.");
    return toMember(row, pending[0]?.n ?? 0);
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    if (me.role !== "admin") throw new Error("Forbidden");
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      email: string;
      display_name: string;
      status: string;
      role: string;
      created_at: string | Date;
    }>`
      select user_id, email, display_name, status, role, created_at
      from members
      order by created_at desc
    `;
    return rows.map(
      (r): MemberRow => ({
        userId: r.user_id,
        email: r.email,
        displayName: r.display_name,
        status: r.status as MemberStatus,
        role: r.role as MemberRole,
        createdAt: new Date(r.created_at).getTime(),
      }),
    );
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; status: "approved" | "rejected" }) => input)
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    if (me.role !== "admin") throw new Error("Forbidden");
    const sql = await getSql();
    if (data.userId !== context.userId) {
      await sql`
        update members
        set status = ${data.status},
            approved_at = ${data.status === "approved" ? new Date().toISOString() : null},
            approved_by = ${context.userId}
        where user_id = ${data.userId}
          and role <> 'admin'
      `;
    }
    const rows = await sql<{
      user_id: string;
      email: string;
      display_name: string;
      status: string;
      role: string;
      created_at: string | Date;
    }>`
      select user_id, email, display_name, status, role, created_at
      from members
      order by created_at desc
    `;
    return rows.map(
      (r): MemberRow => ({
        userId: r.user_id,
        email: r.email,
        displayName: r.display_name,
        status: r.status as MemberStatus,
        role: r.role as MemberRole,
        createdAt: new Date(r.created_at).getTime(),
      }),
    );
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireMember(context.userId);
    if (me.status !== "approved") throw new Error("Forbidden");
    const sql = await getSql();
    await seedReportsIfEmpty(sql);
    const rows = await sql<ReportDb>`
      select id, user_id, type, lat, lng, note, author, created_at
      from reports
      order by created_at desc
    `;
    return rows.map(toReport);
  });

export const createReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { type: ReportTypeId; lat: number; lng: number; note: string; author: string }) => {
    if (!REPORT_TYPE_MAP[input.type]) throw new Error("Tipo inválido");
    if (!pointInArea(input.lat, input.lng)) throw new Error("Fuera del área medida");
    return {
      type: input.type,
      lat: input.lat,
      lng: input.lng,
      note: input.note.trim().slice(0, 280),
      author: input.author.trim().slice(0, 80) || "Vecino",
    };
  })
  .handler(async ({ context, data }) => {
    const me = await requireMember(context.userId);
    if (me.status !== "approved") throw new Error("Forbidden");
    const sql = await getSql();
    const id = crypto.randomUUID();
    const createdAt = new Date();
    await sql`
      insert into reports (id, user_id, type, lat, lng, note, author, created_at)
      values (
        ${id},
        ${context.userId},
        ${data.type},
        ${data.lat},
        ${data.lng},
        ${data.note},
        ${data.author},
        ${createdAt.toISOString()}
      )
    `;
    return {
      id,
      type: data.type,
      lat: data.lat,
      lng: data.lng,
      note: data.note,
      author: data.author,
      createdAt: createdAt.getTime(),
      userId: context.userId,
    } satisfies Report;
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const me = await requireMember(context.userId);
    if (me.status !== "approved") throw new Error("Forbidden");
    const sql = await getSql();
    if (me.role === "admin") {
      await sql`delete from reports where id = ${id}`;
    } else {
      await sql`delete from reports where id = ${id} and user_id = ${context.userId}`;
    }
    return { ok: true };
  });
