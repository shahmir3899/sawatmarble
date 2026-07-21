import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/requireAuth";
import { prisma } from "./config/prisma";
import customersRouter from "./routes/customers";
import suppliersRouter from "./routes/suppliers";
import inventoryRouter from "./routes/inventory";
import paymentsRouter from "./routes/payments";
import receiptsRouter from "./routes/receipts";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/whoami", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/profile", requireAuth, async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.user!.id } });
  res.json({ profile });
});

app.use("/customers", customersRouter);
app.use("/suppliers", suppliersRouter);
app.use("/inventory", inventoryRouter);
app.use("/payments", paymentsRouter);
app.use("/receipts", receiptsRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Sawat Marble API listening on port ${port}`);
});
