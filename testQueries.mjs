import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ukndvvsqreidugcfuiqq.supabase.co', 'sb_publishable_vKdGw8v2RvVte65dqPNrvw_dSomFy7G');

async function test() {
   const queries = [
       { name: 'profiles', promise: supabase.from('profiles').select('*').limit(1) },
       { name: 'dranken', promise: supabase.from('dranken').select('*').limit(1) },
       { name: 'consumpties', promise: supabase.from('consumpties').select('*, dranken(naam, prijs)').limit(1) },
       { name: 'frituur_bestellingen', promise: supabase.from('frituur_bestellingen').select('*').limit(1) },
       { name: 'events', promise: supabase.from('events').select('*').limit(1) },
       { name: 'quotes', promise: supabase.from('quotes').select('*').limit(1) },
       { name: 'notificaties', promise: supabase.from('notificaties').select('*, profiles!notificaties_zender_id_fkey(naam)').limit(1) },
       { name: 'bierpong_games', promise: supabase.from('bierpong_games').select('*').limit(1) },
       { name: 'bierpong_kampioenen', promise: supabase.from('bierpong_kampioenen').select('*').limit(1) },
       { name: 'stock_items', promise: supabase.from('stock_items').select('*').limit(1) },
       { name: 'frituur_sessies', promise: supabase.from('frituur_sessies').select('*').limit(1) },
       { name: 'countdowns', promise: supabase.from('countdowns').select('*').limit(1) },
       { name: 'billing_periods', promise: supabase.from('billing_periods').select('*').order('werkjaar', { ascending: false }).limit(1) },
       { name: 'inkoop_facturen', promise: supabase.from('inkoop_facturen').select('*').limit(1) }
   ];

   const results = await Promise.allSettled(queries.map(q => q.promise));
   let hasError = false;
   results.forEach((res, i) => {
       const qName = queries[i].name;
       if (res.status === 'rejected') {
           console.error(`[ERROR] ${qName} failed:`, res.reason);
           hasError = true;
       } else if (res.value.error) {
           console.error(`[ERROR] ${qName} returned error:`, res.value.error);
           hasError = true;
       } else {
           console.log(`[OK] ${qName} success`);
       }
   });
   if(!hasError) console.log("ALL QUERIES PASSED!");
}
test();
