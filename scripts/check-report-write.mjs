// Explicit opt-in: creates one labelled test row, reads it, then deletes only that row.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { supabase } from '../src/lib/supabase.js';
import { saveReportToDatabase } from '../src/services/reportService.js';

if (!process.argv.includes('--write')) {
  console.log('Use --write to run the temporary shared-database submission check.');
} else if (!supabase) {
  console.error('Supabase client environment is missing.');
  process.exitCode = 1;
} else {
  const id = `integration_${randomUUID()}`;
  let inserted = false;
  try {
    const result = await saveReportToDatabase({
      id, name: '[Integration test] Nearby Reports connection',
      categoryId: 'pipe_leakage', categoryLabel: 'Pipe Leakage',
      addressLine1: 'Automated test fixture', landmark: 'Not a real location',
      description: 'Temporary automated integration check; not a real citizen report.',
      latitude: 0, longitude: 0, photos: [],
    });
    if (!result.success) throw new Error(result.error);
    inserted = true;
    const { data, error } = await supabase.from('Report').select('id,name,categoryId').eq('id', id).single();
    if (error || data?.id !== id || data?.categoryId !== 'pipe_leakage') throw new Error(error?.message || 'Read-back mismatch');
    console.log('PASS: Report saved to Supabase and read back successfully.');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (inserted) {
      const { data, error } = await supabase.from('Report').delete().eq('id', id).select('id');
      if (error || data?.length !== 1) {
        console.error(`Cleanup incomplete for temporary test report ${id}. ${error?.message || 'Delete not permitted.'}`);
        process.exitCode = 1;
      } else {
        console.log('PASS: Temporary test report removed. No existing reports were changed.');
      }
    }
  }
}
