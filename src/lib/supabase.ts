import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL');
const isValidUrl = Boolean(rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')));

export const isSupabaseConfigured = Boolean(isValidUrl && getEnvVar('VITE_SUPABASE_ANON_KEY'));

const supabaseUrl = isValidUrl && rawUrl ? rawUrl : 'https://placeholder-please-configure-secrets.supabase.co';
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
