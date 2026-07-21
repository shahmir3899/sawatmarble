import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/requireAuth";
import { requireRole } from "./middleware/requireRole";
import { prisma } from "./config/prisma";

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

app.get("/customers", requireAuth, async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  res.json({ customers });
});

app.post("/customers", requireAuth, requireRole("owner", "staff"), async (req, res) => {
  const { name, address, phone } = req.body;
  const customer = await prisma.customer.create({ data: { name, address, phone } });
  res.status(201).json({ customer });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Sawat Marble API listening on port ${port}`);
});
