-- ==============================================================================
-- KSA LeidingsApp - Complete Database Schema
-- This file reflects the ACTUAL production schema used by supabaseService.ts.
-- Last updated: 2026-03-06
-- ==============================================================================

-- Maak enum types aan voor de applicatie
CREATE TYPE public.user_role AS ENUM ('admin', 'team_drank', 'standaard', 'sfeerbeheer', 'godmode');
CREATE TYPE public.factuur_status AS ENUM ('betaald', 'onbetaald');
CREATE TYPE public.frituur_status AS ENUM ('open', 'besteld', 'geleverd');

-- ==============================================================================
-- 1. PROFILES (gekoppeld aan auth.users)
-- ==============================================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  naam TEXT NOT NULL,
  email TEXT NOT NULL,
  rol public.user_role DEFAULT 'standaard'::user_role NOT NULL,
  actief BOOLEAN DEFAULT true NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  quick_drink_id UUID,
  roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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


-- ==============================================================================
-- 2. EVENTS (Agenda)
-- ==============================================================================
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titel TEXT NOT NULL,
  datum DATE NOT NULL,
  tijd TIME NOT NULL,
  beschrijving TEXT,
  locatie TEXT NOT NULL,
  type TEXT DEFAULT 'vergadering',
  start_time TEXT,
  end_time TEXT,
  responsible TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 3. DRANKEN (Voorraad en prijzen)
-- ==============================================================================
CREATE TABLE public.dranken (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  naam TEXT NOT NULL,
  prijs NUMERIC(5,2) NOT NULL,
  huidige_voorraad INTEGER DEFAULT 0 NOT NULL,
  categorie TEXT DEFAULT 'Drank' NOT NULL,
  is_temporary BOOLEAN DEFAULT false,
  valid_until TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.dranken ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 4. BILLING PERIODS
-- ==============================================================================
CREATE TABLE public.billing_periods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  naam TEXT NOT NULL,
  start_datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  eind_datum TIMESTAMP WITH TIME ZONE,
  is_closed BOOLEAN DEFAULT false NOT NULL,
  geschatte_kost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 5. FACTUREN (Invoices over een periode)
-- ==============================================================================
CREATE TABLE public.facturen (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_naam TEXT, -- Readable name for admin convenience
  totaal_bedrag NUMERIC(10,2) NOT NULL,
  periode TEXT NOT NULL,
  status public.factuur_status DEFAULT 'onbetaald'::factuur_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.facturen ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 6. CONSUMPTIES (Streepjes)
-- ==============================================================================
CREATE TABLE public.consumpties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_naam TEXT, -- Readable name for admin convenience
  drank_id UUID REFERENCES public.dranken(id) ON DELETE CASCADE NOT NULL,
  aantal INTEGER DEFAULT 1 NOT NULL,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  factuur_id UUID REFERENCES public.facturen(id) ON DELETE SET NULL,
  period_id UUID REFERENCES public.billing_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.consumpties ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 7. BILLING CORRECTIONS
-- ==============================================================================
CREATE TABLE public.billing_corrections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_naam TEXT, -- Readable name for admin convenience
  period_id UUID REFERENCES public.billing_periods(id) ON DELETE CASCADE NOT NULL,
  correctie_bedrag NUMERIC(10,2) NOT NULL,
  notitie TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.billing_corrections ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 8. FRITUUR SESSIES
-- ==============================================================================
CREATE TABLE public.frituur_sessies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  status TEXT DEFAULT 'open' NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  pickup_time TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.frituur_sessies ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 9. FRITUUR BESTELLINGEN
-- ==============================================================================
CREATE TABLE public.frituur_bestellingen (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT,
  sessie_id UUID REFERENCES public.frituur_sessies(id) ON DELETE SET NULL,
  snack_naam TEXT NOT NULL,
  saus TEXT,
  opmerking TEXT,
  items JSONB,
  totaal_prijs NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'open' NOT NULL,
  period_id UUID REFERENCES public.billing_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.frituur_bestellingen ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 10. QUOTES (Wall of fame)
-- ==============================================================================
CREATE TABLE public.quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tekst TEXT NOT NULL,
  auteur TEXT NOT NULL,
  context TEXT,
  toegevoegd_door TEXT,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  upvotes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 11. QUOTE VOTES
-- ==============================================================================
CREATE TABLE public.quote_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_naam TEXT, -- Readable name for admin convenience
  vote_type TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(quote_id, user_id)
);

ALTER TABLE public.quote_votes ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 12. NOTIFICATIES
-- ==============================================================================
CREATE TABLE public.notificaties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  zender_naam TEXT, -- Readable name for admin convenience
  ontvanger_id TEXT NOT NULL, -- UUID voor specifieke user of string 'all' voor iedereen
  titel TEXT NOT NULL,
  bericht TEXT,
  gelezen BOOLEAN DEFAULT false NOT NULL,
  datum TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notificaties ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 13. BIERPONG GAMES
-- ==============================================================================
CREATE TABLE public.bierpong_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_ids UUID[] NOT NULL,
  winner_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bierpong_games ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 14. BIERPONG KAMPIOENEN
-- ==============================================================================
CREATE TABLE public.bierpong_kampioenen (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.bierpong_kampioenen ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 15. STOCK ITEMS
-- ==============================================================================
CREATE TABLE public.stock_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,
  category TEXT DEFAULT 'Standaard',
  count INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'stuks',
  expiry_date TEXT,
  urgent BOOLEAN DEFAULT false,
  icon TEXT DEFAULT 'inventory_2',
  color TEXT DEFAULT 'bg-gray-500',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 16. APP SETTINGS
-- ==============================================================================
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 17. COUNTDOWNS
-- ==============================================================================
CREATE TABLE public.countdowns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.countdowns ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- DUMMY DATA (optioneel handig voor testen van Bar werking)
-- ==============================================================================
INSERT INTO public.dranken (naam, prijs, huidige_voorraad, categorie) VALUES 
('Pils (Stella)', 1.50, 48, 'Bier'),
('Karmeliet', 3.00, 24, 'Speciaalbier'),
('Kriek', 2.00, 12, 'Bier'),
('Cola', 1.00, 24, 'Frisdrank'),
('Water', 1.00, 12, 'Water');
