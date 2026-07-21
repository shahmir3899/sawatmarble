import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  res.json({ suppliers });
});

router.post("/", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const supplier = await prisma.supplier.create({
    data: { name: String(name).trim(), address: address || null, phone: phone || null },
  });
  res.status(201).json({ supplier });
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

  const supplier = await prisma.supplier.update({
    where: { id: String(req.params.id) },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(ledgerBalance !== undefined ? { ledgerBalance: Number(ledgerBalance) } : {}),
    },
  });
  res.json({ supplier });
});

router.delete("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: String(req.params.id) } });
  if (!supplier) {
    return res.status(404).json({ error: "Not found" });
  }
  if (Number(supplier.ledgerBalance) !== 0) {
    return res.status(409).json({ error: "Cannot remove a supplier with a non-zero ledger balance" });
  }
  await prisma.supplier.update({ where: { id: String(req.params.id) }, data: { active: false } });
  res.status(204).send();
});

export default router;
