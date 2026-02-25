-- Maak enum types aan voor de applicatie
CREATE TYPE public.user_role AS ENUM ('admin', 'team_drank', 'standaard');
CREATE TYPE public.factuur_status AS ENUM ('betaald', 'onbetaald');
CREATE TYPE public.frituur_status AS ENUM ('open', 'besteld', 'geleverd');

-- 1. PROFILES (gekoppeld aan auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  naam TEXT NOT NULL,
  email TEXT NOT NULL,
  rol public.user_role DEFAULT 'standaard'::user_role NOT NULL,
  actief BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Zet RLS op profiles (iedereen kan profielen lezen, alleen admin of zelf updaten)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger: Zorgt dat elke nieuwe user automatisch in de `profiles` tabel komt
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, naam, email, rol, actief)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'standaard', true);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. EVENTS (Agenda)
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titel TEXT NOT NULL,
  datum DATE NOT NULL,
  tijd TIME NOT NULL,
  beschrijving TEXT,
  locatie TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are viewable by everyone." ON public.events FOR SELECT USING (true);
CREATE POLICY "Events can be managed by admins." ON public.events FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.rol = 'admin')
);


-- 3. DRANKEN (Voorraad en prijzen)
CREATE TABLE public.dranken (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  naam TEXT NOT NULL,
  prijs NUMERIC(5,2) NOT NULL,
  huidige_voorraad INTEGER DEFAULT 0 NOT NULL,
  categorie TEXT DEFAULT 'Drank' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.dranken ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dranken are viewable by everyone." ON public.dranken FOR SELECT USING (true);
CREATE POLICY "Dranken updatable by team drank and admins." ON public.dranken FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.rol = 'admin' OR profiles.rol = 'team_drank'))
);


-- 4. FACTUREN (Invoices over een periode)
CREATE TABLE public.facturen (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  totaal_bedrag NUMERIC(10,2) NOT NULL,
  periode TEXT NOT NULL,
  status public.factuur_status DEFAULT 'onbetaald'::factuur_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.facturen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own facturen." ON public.facturen FOR SELECT USING (auth.uid() = user_id);
-- Voor de overview door team drank of admins
CREATE POLICY "Team Drank can view all facturen" ON public.facturen FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.rol = 'admin' OR profiles.rol = 'team_drank'))
);
CREATE POLICY "Team drank and admins can update facturen." ON public.facturen FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.rol = 'admin' OR profiles.rol = 'team_drank'))
);


-- 5. CONSUMPTIES (Welke user drinkt wat + optionele link naar een factuur)
CREATE TABLE public.consumpties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  drank_id UUID REFERENCES public.dranken(id) ON DELETE CASCADE NOT NULL,
  aantal INTEGER DEFAULT 1 NOT NULL,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  factuur_id UUID REFERENCES public.facturen(id) ON DELETE SET NULL, -- Om later af te vinken
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.consumpties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own consumpties." ON public.consumpties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Team Drank can view all consumpties." ON public.consumpties FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.rol = 'admin' OR profiles.rol = 'team_drank'))
);
-- Iedereen mag zichzelf strepen. Team_drank/admins mogen iedereen strepen
CREATE POLICY "Anyone can insert consumpties" ON public.consumpties FOR INSERT WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.rol = 'admin' OR profiles.rol = 'team_drank'))
);


-- 6. FRITUUR BESTELLINGEN
CREATE TABLE public.frituur_bestellingen (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  snack_naam TEXT NOT NULL,
  saus TEXT,
  opmerking TEXT,
  status public.frituur_status DEFAULT 'open'::frituur_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.frituur_bestellingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own frituur bestellingen." ON public.frituur_bestellingen FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view and update frituur bestellingen." ON public.frituur_bestellingen FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.rol = 'admin')
);
CREATE POLICY "Users can insert own frituur bestellingen." ON public.frituur_bestellingen FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 7. QUOTES (Wall of fame)
CREATE TABLE public.quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tekst TEXT NOT NULL,
  auteur TEXT NOT NULL,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  upvotes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
-- Iedereen mag quotes lezen, updaten en invoeren (voor upvoting logic)
CREATE POLICY "Quotes are viewable by everyone." ON public.quotes FOR SELECT USING (true);
CREATE POLICY "Quotes can be created by everyone." ON public.quotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Quotes can be upvoted by everyone." ON public.quotes FOR UPDATE USING (true);


-- 8. NOTIFICATIES
CREATE TABLE public.notificaties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ontvanger_id TEXT NOT NULL, -- UUID voor specifieke user of string 'all' voor iedereen
  titel TEXT NOT NULL,
  bericht TEXT,
  gelezen BOOLEAN DEFAULT false NOT NULL,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notificaties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view logic notifications." ON public.notificaties FOR SELECT USING (
  ontvanger_id = 'all' OR ontvanger_id = (auth.uid())::text
);
CREATE POLICY "Users create notifications." ON public.notificaties FOR INSERT WITH CHECK (
  auth.uid() = zender_id
);
CREATE POLICY "Users mark notifications read." ON public.notificaties FOR UPDATE USING (
  ontvanger_id = 'all' OR ontvanger_id = (auth.uid())::text
);

-- DUMMY DATA (optioneel handig voor testen van Bar werking)
INSERT INTO public.dranken (naam, prijs, huidige_voorraad, categorie) VALUES 
('Pils (Stella)', 1.50, 48, 'Bier'),
('Karmeliet', 3.00, 24, 'Speciaalbier'),
('Kriek', 2.00, 12, 'Bier'),
('Cola', 1.00, 24, 'Frisdrank'),
('Water', 1.00, 12, 'Water');
