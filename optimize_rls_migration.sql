-- Supabase Security & Performance Linter Fixes
-- Issue 1: Replace auth.uid() with (select auth.uid()) in all policies to fix 'auth_rls_initplan'
-- Issue 2: Merge overlapping permissive policies per action to fix 'multiple_permissive_policies'

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- We first drop ALL existing policies on the targeted tables to start with a clean slate.
  -- This prevents overlapping policies and ensures the new optimized policies are the only ones active.
  FOR rec IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename IN (
        'profiles', 'events', 'dranken', 'facturen', 'consumpties', 
        'frituur_bestellingen', 'notificaties', 'bierpong_games', 
        'bierpong_kampioenen', 'quote_votes', 'quotes', 'frituur_sessies', 
        'stock_items', 'app_settings', 'countdowns'
      )
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END
$$;

-- Ensure RLS is enabled on all tables (just to be sure)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dranken ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumpties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frituur_bestellingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bierpong_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bierpong_kampioenen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frituur_sessies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countdowns ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------------------
-- 1. PROFILES
----------------------------------------------------------------------------------
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);

----------------------------------------------------------------------------------
-- 2. EVENTS
----------------------------------------------------------------------------------
CREATE POLICY "events_select" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "events_update" ON public.events FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "events_delete" ON public.events FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);

----------------------------------------------------------------------------------
-- 3. DRANKEN
----------------------------------------------------------------------------------
CREATE POLICY "dranken_select" ON public.dranken FOR SELECT USING (true);
CREATE POLICY "dranken_insert" ON public.dranken FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "dranken_update" ON public.dranken FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "dranken_delete" ON public.dranken FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);

----------------------------------------------------------------------------------
-- 4. FACTUREN
----------------------------------------------------------------------------------
CREATE POLICY "facturen_select" ON public.facturen FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "facturen_insert" ON public.facturen FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "facturen_update" ON public.facturen FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "facturen_delete" ON public.facturen FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);

----------------------------------------------------------------------------------
-- 5. CONSUMPTIES
----------------------------------------------------------------------------------
CREATE POLICY "consumpties_select" ON public.consumpties FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "consumpties_insert" ON public.consumpties FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "consumpties_update" ON public.consumpties FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "consumpties_delete" ON public.consumpties FOR DELETE USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);

----------------------------------------------------------------------------------
-- 6. FRITUUR SESSIES
----------------------------------------------------------------------------------
CREATE POLICY "frituur_sessies_select" ON public.frituur_sessies FOR SELECT USING (true);
CREATE POLICY "frituur_sessies_insert" ON public.frituur_sessies FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin') OR (select auth.role()) = 'authenticated'
);
CREATE POLICY "frituur_sessies_update" ON public.frituur_sessies FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin') OR (select auth.role()) = 'authenticated'
);
CREATE POLICY "frituur_sessies_delete" ON public.frituur_sessies FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);

----------------------------------------------------------------------------------
-- 7. FRITUUR BESTELLINGEN
----------------------------------------------------------------------------------
CREATE POLICY "frituur_bestellingen_select" ON public.frituur_bestellingen FOR SELECT USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);
CREATE POLICY "frituur_bestellingen_insert" ON public.frituur_bestellingen FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);
CREATE POLICY "frituur_bestellingen_update" ON public.frituur_bestellingen FOR UPDATE USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);
CREATE POLICY "frituur_bestellingen_delete" ON public.frituur_bestellingen FOR DELETE USING (
  user_id = (select auth.uid()) OR 
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);

----------------------------------------------------------------------------------
-- 8. QUOTES
----------------------------------------------------------------------------------
CREATE POLICY "quotes_select" ON public.quotes FOR SELECT USING (true);
CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE USING ((select auth.role()) = 'authenticated');
CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);

----------------------------------------------------------------------------------
-- 9. QUOTE VOTES
----------------------------------------------------------------------------------
CREATE POLICY "quote_votes_select" ON public.quote_votes FOR SELECT USING (true);
CREATE POLICY "quote_votes_insert" ON public.quote_votes FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "quote_votes_update" ON public.quote_votes FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "quote_votes_delete" ON public.quote_votes FOR DELETE USING (user_id = (select auth.uid()));

----------------------------------------------------------------------------------
-- 10. BIERPONG GAMES
----------------------------------------------------------------------------------
CREATE POLICY "bierpong_games_select" ON public.bierpong_games FOR SELECT USING (true);
CREATE POLICY "bierpong_games_insert" ON public.bierpong_games FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
CREATE POLICY "bierpong_games_update" ON public.bierpong_games FOR UPDATE USING ((select auth.role()) = 'authenticated');
CREATE POLICY "bierpong_games_delete" ON public.bierpong_games FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);

----------------------------------------------------------------------------------
-- 11. BIERPONG KAMPIOENEN
----------------------------------------------------------------------------------
CREATE POLICY "bierpong_kampioenen_select" ON public.bierpong_kampioenen FOR SELECT USING (true);
CREATE POLICY "bierpong_kampioenen_insert" ON public.bierpong_kampioenen FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "bierpong_kampioenen_update" ON public.bierpong_kampioenen FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "bierpong_kampioenen_delete" ON public.bierpong_kampioenen FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);

----------------------------------------------------------------------------------
-- 12. STOCK ITEMS
----------------------------------------------------------------------------------
CREATE POLICY "stock_items_select" ON public.stock_items FOR SELECT USING (true);
CREATE POLICY "stock_items_insert" ON public.stock_items FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "stock_items_update" ON public.stock_items FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "stock_items_delete" ON public.stock_items FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);

----------------------------------------------------------------------------------
-- 13. APP SETTINGS
----------------------------------------------------------------------------------
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_insert" ON public.app_settings FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);
CREATE POLICY "app_settings_delete" ON public.app_settings FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'team_drank'))
);

----------------------------------------------------------------------------------
-- 14. COUNTDOWNS
----------------------------------------------------------------------------------
CREATE POLICY "countdowns_select" ON public.countdowns FOR SELECT USING (true);
CREATE POLICY "countdowns_insert" ON public.countdowns FOR INSERT WITH CHECK (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "countdowns_update" ON public.countdowns FOR UPDATE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);
CREATE POLICY "countdowns_delete" ON public.countdowns FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND (p.rol = 'admin' OR p.rol = 'sfeerbeheer' OR 'Sfeerbeheer' = ANY(p.roles)))
);

----------------------------------------------------------------------------------
-- 15. NOTIFICATIES
----------------------------------------------------------------------------------
CREATE POLICY "notificaties_select" ON public.notificaties FOR SELECT USING (
  ontvanger_id = 'all' OR ontvanger_id = (select auth.uid())::text OR zender_id = (select auth.uid())
);
CREATE POLICY "notificaties_insert" ON public.notificaties FOR INSERT WITH CHECK (
  zender_id = (select auth.uid())
);
CREATE POLICY "notificaties_update" ON public.notificaties FOR UPDATE USING (
  ontvanger_id = 'all' OR ontvanger_id = (select auth.uid())::text
);
CREATE POLICY "notificaties_delete" ON public.notificaties FOR DELETE USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.rol = 'admin')
);
