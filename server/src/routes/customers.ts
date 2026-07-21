import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
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
  const { name, address, phone, ledgerBalance } = req.body;

  // Direct balance edits are owner-only — this is the opening-balance-entry
  // mechanism (Section 8), not a substitute for recording a payment. Staff
  // must go through POST /payments, the audited path, per the permission
  // matrix ("cannot edit ledger balances directly").
  if (ledgerBalance !== undefined && req.profile!.role !== "owner") {
    return res.status(403).json({ error: "Only an owner can edit ledger balance directly" });
  }

  const customer = await prisma.customer.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(ledgerBalance !== undefined ? { ledgerBalance: Number(ledgerBalance) } : {}),
    },
  });
  res.json({ customer });
});

// Staff can remove too (not just owner) — customer/supplier churn is high
// in this business. "Remove" archives (active = false) rather than hard
// deletes: payment history has to survive, and a non-zero ledger balance
// is still blocked so a debt can't silently vanish from view.
router.delete("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: String(req.params.id) } });
  if (!customer) {
    return res.status(404).json({ error: "Not found" });
  }
  if (Number(customer.ledgerBalance) !== 0) {
    return res.status(409).json({ error: "Cannot remove a customer with a non-zero ledger balance" });
  }
  await prisma.customer.update({ where: { id: String(req.params.id) }, data: { active: false } });
  res.status(204).send();
});

export default router;
