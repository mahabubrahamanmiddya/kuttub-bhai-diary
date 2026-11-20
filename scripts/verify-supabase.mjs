import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      let val = trimmed.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('--- SUPABASE CONNECTIVITY & VERIFICATION TEST ---');
console.log('Project URL:', SUPABASE_URL);
console.log('Key prefix:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 16) + '...' : 'MISSING');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runVerification() {
  const results = {
    connection: false,
    authService: false,
    tables: {},
  };

  // 1. Test basic connection via REST OpenAPI root
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    console.log(`REST API Status: ${res.status} ${res.statusText}`);
    if (res.status === 200 || res.status === 404 || res.status === 401 || res.status === 403) {
      results.connection = true;
    }
  } catch (err) {
    console.error('REST API connection error:', err.message);
  }

  // 2. Test Auth endpoint
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_KEY,
      },
    });
    console.log(`Auth API Status: ${authRes.status} ${authRes.statusText}`);
    if (authRes.status === 200) {
      const authSettings = await authRes.json();
      results.authService = true;
      console.log('Auth service active! Settings loaded.');
    }
  } catch (err) {
    console.error('Auth API error:', err.message);
  }

  // 3. Test the five tables
  const tables = ['notes', 'labels', 'note_labels', 'note_versions', 'backups_metadata'];
  for (const table of tables) {
    try {
      const { data, error, status } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ Table '${table}': DOES NOT EXIST (Error 42P01)`);
          results.tables[table] = { exists: false, error: error.message };
        } else {
          console.log(`✓ Table '${table}': EXISTS (Status ${status}, Error/RLS: ${error.message || error.code})`);
          results.tables[table] = { exists: true, rlsActive: true, note: error.message };
        }
      } else {
        console.log(`✓ Table '${table}': EXISTS & ACCESSIBLE (Rows returned: ${data ? data.length : 0})`);
        results.tables[table] = { exists: true, accessible: true, rowCount: data.length };
      }
    } catch (err) {
      console.error(`Error querying table '${table}':`, err.message);
      results.tables[table] = { exists: false, error: err.message };
    }
  }

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(JSON.stringify(results, null, 2));
}

runVerification();
