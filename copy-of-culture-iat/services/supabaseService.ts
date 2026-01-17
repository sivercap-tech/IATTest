import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../constants';

// Initialize client if URL is valid
// Cast to string to avoid TS narrowing to 'never' if the value matches the excluded string
const supabaseUrl = SUPABASE_URL as string;
const isConfigured = supabaseUrl && supabaseUrl !== "https://your-project-id.supabase.co" && supabaseUrl.includes("https://");

const supabase = isConfigured 
  ? createClient(supabaseUrl, SUPABASE_KEY)
  : null;

export const saveResults = async (session: any, results: any) => {
  if (!supabase) {
    console.warn("Supabase not configured. Check constants.ts");
    return { 
      error: { 
        message: "Supabase URL не настроен. Проверьте constants.ts. URL должен быть вида https://xyz.supabase.co" 
      } 
    };
  }

  try {
    // Assuming a table named 'iat_results' exists
    const { data, error } = await supabase
      .from('iat_results')
      .insert([
        { 
          user_id: session.userId,
          referrer: session.referrer,
          results_json: results,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    return { data };
  } catch (error) {
    console.error("Error saving results:", error);
    return { error };
  }
};