import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import type { QuotationStatus } from "../generated/prisma/enums";
import { streamQuotationPdf } from "../pdf/quotationPdf";

const router = Router();

const STANDARD_TERMS = [
  "In all natural Granite stones, variation in shades, veins & grains is possible.",
  "50% advance on order confirmation.",
  "Delay in delivery is possible due to unavoidable circumstances.",
  "Quantity & Quality should be checked at the time of delivery.",
  "No Guarantee of color variation.",
].join("\n");

const VALID_STATUSES: QuotationStatus[] = ["draft", "sent", "accepted", "expired"];

router.get("/", requireAuth, async (req, res) => {
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  const quotations = await prisma.quotation.findMany({
    where: customerId ? { customerId } : {},
    orderBy: { createdAt: "desc" },
  });
  res.json({ quotations });
});

router.get("/:id", requireAuth, async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!quotation) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json({ quotation });
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!quotation) {
    return res.status(404).json({ error: "Not found" });
  }

  streamQuotationPdf(
    {
      quotationNo: quotation.quotationNo,
      date: quotation.date,
      status: quotation.status,
      itemsTotal: quotation.itemsTotal.toString(),
      termsSnapshot: quotation.termsSnapshot,
      customer: {
        name: quotation.customer.name,
        address: quotation.customer.address,
        phone: quotation.customer.phone,
      },
      items: quotation.items.map((item) => ({
        description: item.description,
        size: item.size,
        qty: item.qty.toString(),
        sqft: item.sqft.toString(),
        ratePerSqft: item.ratePerSqft.toString(),
        amount: item.amount.toString(),
      })),
    },
    res
  );
});

type IncomingItem = {
  description: string;
  size?: string;
  qty: number;
  sqft: number;
  ratePerSqft: number;
  amount: number;
};

function validateItems(items: unknown): items is IncomingItem[] {
  return Array.isArray(items) && items.length > 0 && items.every((i) => i.description && String(i.description).trim());
}

// Quotations never touch the ledger — nothing financial has been
// committed yet, so unlike Receipts, they stay fully editable.
router.post("/", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { customerId, items } = req.body as { customerId?: string; items?: IncomingItem[] };

  if (!customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (!validateItems(items)) {
    return res.status(400).json({ error: "at least one line item with a description is required" });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.active) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const quotation = await prisma.quotation.create({
    data: {
      customerId,
      itemsTotal,
      termsSnapshot: STANDARD_TERMS,
      createdBy: req.user!.id,
      items: {
        create: items.map((item, index) => ({
          description: String(item.description).trim(),
          size: item.size || null,
          qty: Number(item.qty) || 1,
          sqft: Number(item.sqft) || 0,
          ratePerSqft: Number(item.ratePerSqft) || 0,
          amount: Number(item.amount) || 0,
          sortOrder: index,
        })),
      },
    },
    include: { items: true },
  });

  res.status(201).json({ quotation });
});

router.patch("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const id = String(req.params.id);
  const { customerId, status, items } = req.body as {
    customerId?: string;
    status?: string;
    items?: IncomingItem[];
  };

  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as QuotationStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (items !== undefined && !validateItems(items)) {
    return res.status(400).json({ error: "at least one line item with a description is required" });
  }

  const itemsTotal = items !== undefined ? items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : undefined;

  const quotation = await prisma.$transaction(async (tx) => {
    if (items !== undefined) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    }
    return tx.quotation.update({
      where: { id },
      data: {
        ...(customerId !== undefined ? { customerId } : {}),
        ...(status !== undefined ? { status: status as QuotationStatus } : {}),
        ...(itemsTotal !== undefined ? { itemsTotal } : {}),
        ...(items !== undefined
          ? {
              items: {
                create: items.map((item, index) => ({
                  description: String(item.description).trim(),
                  size: item.size || null,
                  qty: Number(item.qty) || 1,
                  sqft: Number(item.sqft) || 0,
                  ratePerSqft: Number(item.ratePerSqft) || 0,
                  amount: Number(item.amount) || 0,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });

  res.json({ quotation });
});

// No ledger implications, unlike customers/inventory — hard delete is fine.
router.delete("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.quotation.delete({ where: { id } });
  res.status(204).send();
});

export default router;
