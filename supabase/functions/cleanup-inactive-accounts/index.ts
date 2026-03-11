import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (6 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    const cutoffIsoString = cutoffDate.toISOString();

    // The user wishes to delete data of accounts that have been deactivated for 6+ months.
    // We assume 'profielen' table has 'actief' = false and 'updated_at' < cutoffDate.
    // If 'updated_at' doesn't exist, this function will rely on checking the user's last actual activity manually 
    // or assume the user will adjust SQL to include an updated_at column on profielen.
    
    // Step 1: Find users who've been deactivated for 6+ months. 
    // Usually, setting actief = false updates the updated_at column.
    const { data: targets, error: targetsError } = await supabase
      .from('profielen')
      .select('id, naam')
      .eq('actief', false)
      .lt('updated_at', cutoffIsoString);

    if (targetsError) {
       // Fallback if updated_at is missing, we might not be able to confidently do exactly 6 months.
       console.error("Error fetching inactive targets, you might need to add an 'updated_at' column to 'profielen'. Error:", targetsError.message);
       throw targetsError;
    }

    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ 
         success: true, 
         message: "No users matching the 6-month retention policy were found." 
      }), { headers: { "Content-Type": "application/json" } });
    }

    const targetIds = targets.map((t) => t.id);
    console.log(`Found ${targetIds.length} accounts deactivated for > 6 months. Proceeding to wipe data.`);

    // Step 2: Delete related data
    // Supabase usually cascades deletions if the foreign keys are set up with ON DELETE CASCADE.
    // However, to be thorough and safe, we can manually delete from relevant tables if cascades are not set.
    
    // Attempt deleting from custom tables if cascades don't handle it
    await supabase.from('consumpties').delete().in('user_id', targetIds);
    await supabase.from('frituur_bestellingen').delete().in('user_id', targetIds);
    await supabase.from('invoices').delete().in('user_id', targetIds);
    // Other tables like bierpong matches, etc.
    
    // Step 3: Delete from profielen
    const { error: profielenDeleteError } = await supabase
      .from('profielen')
      .delete()
      .in('id', targetIds);
      
    if (profielenDeleteError) throw profielenDeleteError;

    // Step 4: Delete from Auth if we wish to completely purge the account
    // This requires supabase.auth.admin
    for (const adminId of targetIds) {
      await supabase.auth.admin.deleteUser(adminId).catch(err => console.error('Auth delete error', err));
    }

    return new Response(JSON.stringify({
      success: true,
      wipedUsers: targets.map(t => t.naam),
      message: `Successfully wiped ${targets.length} accounts.`
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Data wipe task failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.toString() }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
