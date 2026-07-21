import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// Section 3.3 of the plan — the standard printed terms from the paper
// invoice book. Snapshotted onto each receipt at creation time. Owner-
// editable footer terms are a later enhancement; this is the fixed v1 text.
const STANDARD_TERMS = [
  "In all natural Granite stones, variation in shades, veins & grains is possible.",
  "50% advance on order confirmation.",
  "Delay in delivery is possible due to unavoidable circumstances.",
  "Quantity & Quality should be checked at the time of delivery.",
  "No Guarantee of color variation.",
].join("\n");

router.get("/", requireAuth, async (req, res) => {
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  const receipts = await prisma.receipt.findMany({
    where: customerId ? { customerId } : {},
    orderBy: { invoiceNo: "desc" },
  });
  res.json({ receipts });
});

router.get("/:id", requireAuth, async (req, res) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!receipt) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json({ receipt });
});

type IncomingItem = {
  description: string;
  size?: string;
  qty: number;
  sqft: number;
  ratePerSqft: number;
  amount: number;
};

// The financial-close transaction: snapshot the customer's balance, total
// the line items, compute Total/Balance exactly per the paper invoice's
// formula, write the receipt + items, record the advance as a Payment (so
// it shows up in the Ledger dialog too), and set the customer's new
// balance — all in one DB transaction.
router.post("/", requireAuth, requireRole("owner", "staff", "accountant"), async (req, res) => {
  const { customerId, items, advance, method } = req.body as {
    customerId?: string;
    items?: IncomingItem[];
    advance?: number;
    method?: string;
  };

  if (!customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "at least one line item is required" });
  }
  for (const item of items) {
    if (!item.description || !String(item.description).trim()) {
      return res.status(400).json({ error: "each item requires a description" });
    }
  }

  const advanceNum = Number(advance) || 0;
  if (advanceNum < 0) {
    return res.status(400).json({ error: "advance cannot be negative" });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.active) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const previousBalance = Number(customer.ledgerBalance);
  const total = previousBalance + itemsTotal;
  const balance = total - advanceNum;

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.receipt.create({
      data: {
        customerId,
        previousBalance,
        itemsTotal,
        total,
        advance: advanceNum,
        balance,
        termsSnapshot: STANDARD_TERMS,
        createdBy: req.user!.id,
        items: {
          create: items.map((item, index) => ({
            description: String(item.description).trim(),
            size: item.size || null,
            qty: Number(item.qty) || 0,
            sqft: Number(item.sqft) || 0,
            ratePerSqft: Number(item.ratePerSqft) || 0,
            amount: Number(item.amount) || 0,
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    });

    if (advanceNum > 0) {
      await tx.payment.create({
        data: {
          customerId,
          amount: advanceNum,
          method: method || "cash",
          note: `Advance for Invoice #${created.invoiceNo}`,
          referenceType: "receipt",
          referenceId: created.id,
          createdBy: req.user!.id,
        },
      });
    }

    await tx.customer.update({
      where: { id: customerId },
      data: { ledgerBalance: balance },
    });

    return created;
  });

  res.status(201).json({ receipt });
});

export default router;
