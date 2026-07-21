import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Pakistan doesn't observe DST, so a fixed +5:00 offset is safe and
// correct — "today" here means "today in Rawalpindi", not the server's
// own timezone (Render's containers run in UTC).
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function todayBoundsUtc() {
  const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
  const startOfTodayPkt = Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), nowPkt.getUTCDate());
  const start = new Date(startOfTodayPkt - PKT_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

type ActivityEntry = {
  type: "receipt" | "quotation" | "challan" | "payment";
  id: string;
  label: string;
  amount: string | null;
  createdAt: Date;
};

router.get("/", requireAuth, async (_req, res) => {
  const { start, end } = todayBoundsUtc();

  const [todaysSalesAgg, receivablesAgg, lowStockCandidates, recentReceipts, recentQuotations, recentChallans, recentPayments] =
    await Promise.all([
      prisma.receipt.aggregate({
        where: { date: { gte: start, lt: end } },
        _sum: { itemsTotal: true },
      }),
      prisma.customer.aggregate({
        where: { active: true, ledgerBalance: { gt: 0 } },
        _sum: { ledgerBalance: true },
      }),
      prisma.inventoryItem.findMany({
        where: { active: true, reorderLevel: { not: null } },
      }),
      prisma.receipt.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { customer: true } }),
      prisma.quotation.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { customer: true } }),
      prisma.deliveryChallan.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { customer: true } }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, supplier: true },
      }),
    ]);

  const lowStockItems = lowStockCandidates.filter(
    (item) => item.reorderLevel !== null && Number(item.qtyOnHand) <= Number(item.reorderLevel)
  );

  const activity: ActivityEntry[] = [
    ...recentReceipts.map((r) => ({
      type: "receipt" as const,
      id: r.id,
      label: `Invoice #${r.invoiceNo} — ${r.customer.name}`,
      amount: r.total.toString(),
      createdAt: r.createdAt,
    })),
    ...recentQuotations.map((q) => ({
      type: "quotation" as const,
      id: q.id,
      label: `Quotation ${q.quotationNo} — ${q.customer.name}`,
      amount: q.itemsTotal.toString(),
      createdAt: q.createdAt,
    })),
    ...recentChallans.map((c) => ({
      type: "challan" as const,
      id: c.id,
      label: `Challan ${c.challanNo} — ${c.customer.name}`,
      amount: c.itemsTotal.toString(),
      createdAt: c.createdAt,
    })),
    ...recentPayments.map((p) => ({
      type: "payment" as const,
      id: p.id,
      label: `Payment from/to ${p.customer?.name ?? p.supplier?.name ?? "unknown"}`,
      amount: p.amount.toString(),
      createdAt: p.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15);

  res.json({
    todaysSales: (todaysSalesAgg._sum.itemsTotal ?? 0).toString(),
    outstandingReceivables: (receivablesAgg._sum.ledgerBalance ?? 0).toString(),
    lowStockItems: lowStockItems.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      unit: item.unit,
      qtyOnHand: item.qtyOnHand.toString(),
      reorderLevel: item.reorderLevel!.toString(),
    })),
    recentActivity: activity,
  });
});

export default router;
