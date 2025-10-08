// lib/supabase.js
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase.com/dashboard/project/gojfugdhndzhuxehoyvb';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvamZ1Z2RobmR6aHV4ZWhveXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTEwNzgsImV4cCI6MjA3NTUyNzA3OH0.Mz94nXAQw3z1HRADATmaNTzPL_-OrX6P8YXXRvpgHHc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});