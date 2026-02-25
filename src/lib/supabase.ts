import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
// Note: Normally, you'd use import.meta.env.VITE_SUPABASE_URL
// and import.meta.env.VITE_SUPABASE_ANON_KEY.
// Using placeholders for now to let the project build.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
