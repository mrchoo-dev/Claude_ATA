import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ycopchmcvjjbcfopuywy.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljb3BjaG1jdmpqYmNmb3B1eXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjI3NzQsImV4cCI6MjA5ODEzODc3NH0.maP1adRd7tSuChZw5TtiMEyXPl8vm8ZosGI-ZyMy0QA';

export const supabase = createClient(supabaseUrl, supabaseKey);
