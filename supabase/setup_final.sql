-- FINAL SETUP SCRIPT FOR APPLICATIEANTIGRAV
-- Plak dit in de Supabase SQL Editor

-- 1. Tabel-aanpassing: maak snack_naam optioneel voor de nieuwe winkelmand-flow
ALTER TABLE public.frituur_bestellingen ALTER COLUMN snack_naam DROP NOT NULL;

-- 2. "Nuke" alle oude policies op bestellingen en profielen om conflicten te wissen
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'frituur_bestellingen' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.frituur_bestellingen', pol.policyname);
    END LOOP;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'SELECT' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Maak nieuwe policies: Iedereen die ingelogd is mag alles (nodig voor bestellen voor anderen)
CREATE POLICY "frituur_vrij_bestellen" ON public.frituur_bestellingen FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "profiles_vrij_lezen" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Activeer Realtime voor alle relevante tabellen
-- Tip: Run deze alleen als ze nog niet toegevoegd waren.
-- Als je een fout krijgt dat ze al bestaan, kun je dat negeren.
ALTER PUBLICATION supabase_realtime ADD TABLE public.frituur_bestellingen;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bierpong_games;

-- 5. BRICK 2: Enum opschonen & Trigger herstellen
-- Idealiter drop en recreate je de type als je database nog leeg is.
-- Hier hernoemen we de oude waarde voor de veiligheid.
ALTER TYPE public.user_role RENAME VALUE 'team drank' TO 'team_drank_old' ;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, naam, email, rol, actief)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), -- Fallback naar e-mail prefix
    new.email, 
    'standaard', 
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. BRICK 3: Profiles Schema Update (FCM Support)
-- Voeg de ontbrekende kolom toe voor push-notificaties
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
