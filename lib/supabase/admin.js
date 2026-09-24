import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Клиент с service_role ключом — обходит RLS и умеет приглашать пользователей.
// Использовать ТОЛЬКО в серверном коде (route handlers), никогда в клиентских
// компонентах и никогда не логировать/не возвращать ключ на фронт.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
