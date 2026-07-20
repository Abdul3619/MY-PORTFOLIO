import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const run = async () => {
  const { data } = await supabaseAdmin.from('profiles').select('bio').limit(1).single();
  const bio = JSON.parse(data.bio);
  console.log('published projects statuses:', bio.published_snapshot.projects.map((p: any) => p.status));
};
run();
