import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "SUPABASE_URL / SUPABASE_ANON_KEY are not set — auth middleware will reject all requests until configured."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
