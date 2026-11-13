import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.from('Report').select('id').limit(0).abortSignal(AbortSignal.timeout(15000));
  // limit(0) verifies connectivity/table access without disclosing report contents.
  console.log(result.error ? `Report connection failed: ${result.error.message}` : 'Report table is reachable via Supabase.');
  process.exitCode = result.error ? 1 : 0;
}
