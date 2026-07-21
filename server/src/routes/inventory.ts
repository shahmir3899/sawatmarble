import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const VALID_UNITS = ["sqft", "piece"];

router.get("/", requireAuth, async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ orderBy: { description: "asc" } });
  res.json({ items });
});

router.post("/", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { category, subCategory, description, size, unit, defaultRatePerSqft, qtyOnHand } = req.body;

  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: "category is required" });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  if (unit !== undefined && !VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `unit must be one of: ${VALID_UNITS.join(", ")}` });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      category: String(category).trim(),
      subCategory: subCategory || null,
      description: String(description).trim(),
      size: size || null,
      unit: unit || "sqft",
      defaultRatePerSqft: defaultRatePerSqft ?? null,
      qtyOnHand: qtyOnHand ?? 0,
    },
  });
  res.status(201).json({ item });
});

router.patch("/:id", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { category, subCategory, description, size, unit, defaultRatePerSqft, qtyOnHand } = req.body;

  if (unit !== undefined && !VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: `unit must be one of: ${VALID_UNITS.join(", ")}` });
  }

  const item = await prisma.inventoryItem.update({
    where: { id: String(req.params.id) },
    data: {
      ...(category !== undefined ? { category: String(category).trim() } : {}),
      ...(subCategory !== undefined ? { subCategory: subCategory || null } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(size !== undefined ? { size: size || null } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(defaultRatePerSqft !== undefined ? { defaultRatePerSqft } : {}),
      ...(qtyOnHand !== undefined ? { qtyOnHand } : {}),
    },
  });
  res.json({ item });
});

// Owner-only: removing an item type outright is rarer and more consequential
// than adding/removing a customer or supplier contact.
router.delete("/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id: String(req.params.id) } });
  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }
  if (Number(item.qtyOnHand) !== 0) {
    return res.status(409).json({ error: "Cannot delete an item with non-zero quantity on hand" });
  }
  await prisma.inventoryItem.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
});

export default router;
