import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/config/prisma";
import type { Role } from "../src/generated/prisma/enums";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in server/.env");
  process.exit(1);
}

// Throwaway demo credentials, not real business accounts.
const SEED_PASSWORD = "SawatDemo123!";

const SEED_ACCOUNTS: { email: string; role: Role }[] = [
  { email: "owner@sawatmarble.test", role: "owner" },
  { email: "staff@sawatmarble.test", role: "staff" },
  { email: "accountant@sawatmarble.test", role: "accountant" },
];

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email: string) {
  // Small user base for this project — one page is enough.
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email);
}

async function seedAccounts() {
  for (const account of SEED_ACCOUNTS) {
    let userId: string;
    const existing = await findUserByEmail(account.email);

    if (existing) {
      userId = existing.id;
      console.log(`[skip-create] ${account.email} already exists`);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: account.email,
        password: SEED_PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create ${account.email}: ${error?.message}`);
      }
      userId = data.user.id;
      console.log(`[created] ${account.email}`);
    }

    await prisma.profile.upsert({
      where: { id: userId },
      update: { role: account.role, name: account.role },
      create: { id: userId, role: account.role, name: account.role },
    });
    console.log(`[role-set] ${account.email} -> ${account.role}`);
  }
}

async function removeAccount(email: string) {
  const existing = await findUserByEmail(email);
  if (!existing) {
    console.log(`[skip-delete] ${email} not found`);
    return;
  }
  const { error } = await adminClient.auth.admin.deleteUser(existing.id);
  if (error) throw new Error(`Failed to delete ${email}: ${error.message}`);
  console.log(`[deleted] ${email} (profiles row cascades automatically)`);
}

async function main() {
  await removeAccount("shahmir3899@gmail.com");
  await seedAccounts();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
