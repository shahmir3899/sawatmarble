import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import type { ChallanStatus } from "../generated/prisma/enums";
import { streamChallanPdf } from "../pdf/challanPdf";

const router = Router();

const STANDARD_TERMS = [
  "In all natural Granite stones, variation in shades, veins & grains is possible.",
  "50% advance on order confirmation.",
  "Delay in delivery is possible due to unavoidable circumstances.",
  "Quantity & Quality should be checked at the time of delivery.",
  "No Guarantee of color variation.",
].join("\n");

const VALID_STATUSES: ChallanStatus[] = ["draft", "dispatched", "delivered"];

router.get("/", requireAuth, async (req, res) => {
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  const challans = await prisma.deliveryChallan.findMany({
    where: customerId ? { customerId } : {},
    orderBy: { createdAt: "desc" },
  });
  res.json({ challans });
});

router.get("/:id", requireAuth, async (req, res) => {
  const challan = await prisma.deliveryChallan.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!challan) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json({ challan });
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const challan = await prisma.deliveryChallan.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!challan) {
    return res.status(404).json({ error: "Not found" });
  }

  streamChallanPdf(
    {
      challanNo: challan.challanNo,
      date: challan.date,
      status: challan.status,
      vehicleNumber: challan.vehicleNumber,
      driverName: challan.driverName,
      itemsTotal: challan.itemsTotal.toString(),
      termsSnapshot: challan.termsSnapshot,
      customer: {
        name: challan.customer.name,
        address: challan.customer.address,
        phone: challan.customer.phone,
      },
      items: challan.items.map((item) => ({
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

// Delivery Challans never touch the ledger — same reasoning as Quotation,
// so they stay fully editable after creation.
router.post("/", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { customerId, quotationId, vehicleNumber, driverName, items } = req.body as {
    customerId?: string;
    quotationId?: string;
    vehicleNumber?: string;
    driverName?: string;
    items?: IncomingItem[];
  };

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

  if (quotationId) {
    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }
  }

  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const challan = await prisma.deliveryChallan.create({
    data: {
      customerId,
      quotationId: quotationId || null,
      vehicleNumber: vehicleNumber || null,
      driverName: driverName || null,
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

  res.status(201).json({ challan });
});

router.patch("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const id = String(req.params.id);
  const { customerId, quotationId, vehicleNumber, driverName, status, items } = req.body as {
    customerId?: string;
    quotationId?: string | null;
    vehicleNumber?: string;
    driverName?: string;
    status?: string;
    items?: IncomingItem[];
  };

  const existing = await prisma.deliveryChallan.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as ChallanStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (items !== undefined && !validateItems(items)) {
    return res.status(400).json({ error: "at least one line item with a description is required" });
  }

  const itemsTotal = items !== undefined ? items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : undefined;

  const challan = await prisma.$transaction(async (tx) => {
    if (items !== undefined) {
      await tx.deliveryChallanItem.deleteMany({ where: { challanId: id } });
    }
    return tx.deliveryChallan.update({
      where: { id },
      data: {
        ...(customerId !== undefined ? { customerId } : {}),
        ...(quotationId !== undefined ? { quotationId } : {}),
        ...(vehicleNumber !== undefined ? { vehicleNumber: vehicleNumber || null } : {}),
        ...(driverName !== undefined ? { driverName: driverName || null } : {}),
        ...(status !== undefined ? { status: status as ChallanStatus } : {}),
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

  res.json({ challan });
});

// No ledger implications — hard delete is fine.
router.delete("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.deliveryChallan.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.deliveryChallan.delete({ where: { id } });
  res.status(204).send();
});

export default router;
