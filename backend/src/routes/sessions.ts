import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { contactLogSchema, createSearchSchema } from "../lib/validation.js";
import { findNearbyPharmacies } from "../services/pharmacySearch.js";

export const sessionsRouter = Router();

function sessionSummary(session: {
  id: string;
  medicationName: string;
  strength: string | null;
  zipCode: string;
  createdAt: Date;
  pharmacies: {
    contactLogs: { status: string }[];
  }[];
}) {
  const pharmacies = session.pharmacies;
  const latestStatus = (p: (typeof pharmacies)[0]) =>
    p.contactLogs[0]?.status ?? "not_contacted";

  return {
    id: session.id,
    medicationName: session.medicationName,
    strength: session.strength,
    zipCode: session.zipCode,
    createdAt: session.createdAt,
    pharmacyCount: pharmacies.length,
    contactedCount: pharmacies.filter((p) => latestStatus(p) !== "not_contacted")
      .length,
    inStockCount: pharmacies.filter((p) => latestStatus(p) === "in_stock")
      .length,
  };
}

sessionsRouter.get("/", async (_req, res) => {
  const sessions = await prisma.searchSession.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pharmacies: {
        include: {
          contactLogs: { orderBy: { contactedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  res.json(sessions.map(sessionSummary));
});

sessionsRouter.get("/export/all.csv", async (_req, res) => {
  const sessions = await prisma.searchSession.findMany({
    include: {
      pharmacies: {
        include: {
          contactLogs: { orderBy: { contactedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const header =
    "session_id,medication,strength,zip,pharmacy,address,phone,distance_mi,status,note,contacted_at";
  const rows: string[] = [];

  for (const s of sessions) {
    for (const p of s.pharmacies) {
      const log = p.contactLogs[0];
      const esc = (v: string | null | undefined) =>
        `"${(v ?? "").replace(/"/g, '""')}"`;
      rows.push(
        [
          s.id,
          s.medicationName,
          s.strength,
          s.zipCode,
          p.name,
          p.address,
          p.phone,
          p.distanceMiles?.toString() ?? "",
          log?.status ?? "not_contacted",
          log?.note ?? "",
          log?.contactedAt?.toISOString() ?? "",
        ]
          .map(esc)
          .join(",")
      );
    }
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="medfinder-export-all.csv"'
  );
  res.send([header, ...rows].join("\n"));
});

sessionsRouter.get("/dashboard", async (_req, res) => {
  const sessions = await prisma.searchSession.findMany({
    include: {
      pharmacies: {
        include: {
          contactLogs: { orderBy: { contactedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  let pharmaciesFound = 0;
  let pharmaciesContacted = 0;
  let inStock = 0;
  let outOfStock = 0;
  let pendingFollowUp = 0;

  for (const s of sessions) {
    for (const p of s.pharmacies) {
      pharmaciesFound++;
      const status = p.contactLogs[0]?.status ?? "not_contacted";
      if (status !== "not_contacted") pharmaciesContacted++;
      if (status === "in_stock") inStock++;
      if (status === "out_of_stock") outOfStock++;
      if (
        ["called", "left_voicemail", "will_order", "partial_stock"].includes(
          status
        )
      ) {
        pendingFollowUp++;
      }
    }
  }

  res.json({
    totalSessions: sessions.length,
    pharmaciesFound,
    pharmaciesContacted,
    inStock,
    outOfStock,
    pendingFollowUp,
  });
});

sessionsRouter.get("/:id", async (req, res) => {
  const session = await prisma.searchSession.findUnique({
    where: { id: req.params.id },
    include: {
      pharmacies: {
        include: {
          contactLogs: { orderBy: { contactedAt: "desc" } },
        },
        orderBy: { distanceMiles: "asc" },
      },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.post("/", async (req, res) => {
  const parsed = createSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { medicationName, strength, quantity, zipCode, radius, userNotes } =
    parsed.data;

  const { pharmacies, usedFallback } = await findNearbyPharmacies(
    zipCode,
    radius
  );

  const session = await prisma.searchSession.create({
    data: {
      medicationName,
      strength,
      quantity,
      zipCode: zipCode.slice(0, 5),
      radius,
      userNotes,
      pharmacies: {
        create: pharmacies.map((p) => ({
          name: p.name,
          address: p.address,
          phone: p.phone,
          lat: p.lat,
          lng: p.lng,
          distanceMiles: p.distanceMiles,
          source: p.source,
        })),
      },
    },
    include: {
      pharmacies: {
        include: { contactLogs: true },
        orderBy: { distanceMiles: "asc" },
      },
    },
  });

  res.status(201).json({ session, usedFallback });
});

sessionsRouter.get("/:id/export", async (req, res) => {
  const session = await prisma.searchSession.findUnique({
    where: { id: req.params.id },
    include: {
      pharmacies: {
        include: { contactLogs: { orderBy: { contactedAt: "desc" } } },
      },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="medfinder-session-${session.id}.json"`
  );
  res.json(session);
});

sessionsRouter.post("/:sessionId/pharmacies/:pharmacyId/contact", async (req, res) => {
  const parsed = contactLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const pharmacy = await prisma.pharmacy.findFirst({
    where: {
      id: req.params.pharmacyId,
      searchSessionId: req.params.sessionId,
    },
  });

  if (!pharmacy) {
    res.status(404).json({ error: "Pharmacy not found" });
    return;
  }

  const log = await prisma.pharmacyContactLog.create({
    data: {
      pharmacyId: pharmacy.id,
      ...parsed.data,
    },
  });

  res.status(201).json(log);
});

sessionsRouter.delete("/:id", async (req, res) => {
  await prisma.searchSession.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
