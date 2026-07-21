import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  res.json({ customers });
});

router.post("/", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const customer = await prisma.customer.create({
    data: { name: String(name).trim(), address: address || null, phone: phone || null },
  });
  res.status(201).json({ customer });
});

router.patch("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { name, address, phone } = req.body;
  const customer = await prisma.customer.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
    },
  });
  res.json({ customer });
});

// Staff can delete too (not just owner) — customer/supplier churn is high
// in this business; blocking on a non-zero ledger balance is the only
// safety rail, since that indicates real transaction history to preserve.
router.delete("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: String(req.params.id) } });
  if (!customer) {
    return res.status(404).json({ error: "Not found" });
  }
  if (Number(customer.ledgerBalance) !== 0) {
    return res.status(409).json({ error: "Cannot delete a customer with a non-zero ledger balance" });
  }
  await prisma.customer.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
});

export default router;
