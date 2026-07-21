import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  const supplierId = req.query.supplierId ? String(req.query.supplierId) : undefined;

  if (!customerId && !supplierId) {
    return res.status(400).json({ error: "customerId or supplierId query param is required" });
  }
  if (customerId && supplierId) {
    return res.status(400).json({ error: "provide only one of customerId or supplierId" });
  }

  const payments = await prisma.payment.findMany({
    where: customerId ? { customerId } : { supplierId: supplierId! },
    orderBy: { paymentDate: "desc" },
  });
  res.json({ payments });
});

// The atomic ledger-affecting event: creating the payment record and
// decrementing the party's ledgerBalance happen in one DB transaction,
// so the two can never drift out of sync.
router.post("/", requireAuth, requireRole("owner", "staff", "accountant"), async (req, res) => {
  const { customerId, supplierId, amount, method, note, paymentDate } = req.body;

  if (!customerId && !supplierId) {
    return res.status(400).json({ error: "customerId or supplierId is required" });
  }
  if (customerId && supplierId) {
    return res.status(400).json({ error: "provide only one of customerId or supplierId" });
  }
  const amountNum = Number(amount);
  if (!amountNum || Number.isNaN(amountNum)) {
    return res.status(400).json({ error: "amount must be a non-zero number" });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          customerId: customerId || null,
          supplierId: supplierId || null,
          amount: amountNum,
          method: method || null,
          note: note || null,
          ...(paymentDate ? { paymentDate: new Date(paymentDate) } : {}),
          createdBy: req.user!.id,
        },
      });

      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { ledgerBalance: { decrement: amountNum } },
        });
      } else {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { ledgerBalance: { decrement: amountNum } },
        });
      }

      return created;
    });

    res.status(201).json({ payment });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Foreign key constraint")) {
      return res.status(404).json({ error: "Customer or supplier not found" });
    }
    throw err;
  }
});

export default router;
