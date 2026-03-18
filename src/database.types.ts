export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bierpong_games: {
        Row: {
          created_at: string
          id: string
          player_ids: string[]
          winner_id: string
          winner_ids: string[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          player_ids: string[]
          winner_id: string
          winner_ids?: string[] | null
        }
        Update: {
          created_at?: string
          id?: string
          player_ids?: string[]
          winner_id?: string
          winner_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bierpong_games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bierpong_kampioenen: {
        Row: {
          created_at: string
          id: string
          player_ids: string[]
          titel: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          player_ids: string[]
          titel?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          player_ids?: string[]
          titel?: string | null
        }
        Relationships: []
      }
      billing_corrections: {
        Row: {
          correctie_bedrag: number
          created_at: string
          id: string
          notitie: string | null
          period_id: string
          user_id: string
          user_naam: string | null
        }
        Insert: {
          correctie_bedrag?: number
          created_at?: string
          id?: string
          notitie?: string | null
          period_id: string
          user_id: string
          user_naam?: string | null
        }
        Update: {
          correctie_bedrag?: number
          created_at?: string
          id?: string
          notitie?: string | null
          period_id?: string
          user_id?: string
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_corrections_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          created_at: string
          eind_datum: string | null
          geschatte_kost: number
          gsheet_sheet_id: string | null
          id: string
          is_closed: boolean
          naam: string
          start_datum: string
          werkjaar: string | null
        }
        Insert: {
          created_at?: string
          eind_datum?: string | null
          geschatte_kost?: number
          gsheet_sheet_id?: string | null
          id?: string
          is_closed?: boolean
          naam: string
          start_datum?: string
          werkjaar?: string | null
        }
        Update: {
          created_at?: string
          eind_datum?: string | null
          geschatte_kost?: number
          gsheet_sheet_id?: string | null
          id?: string
          is_closed?: boolean
          naam?: string
          start_datum?: string
          werkjaar?: string | null
        }
        Relationships: []
      }
      consumpties: {
        Row: {
          aantal: number
          created_at: string
          datum: string
          drank_id: string
          factuur_id: string | null
          id: string
          period_id: string | null
          user_id: string
          user_naam: string | null
        }
        Insert: {
          aantal?: number
          created_at?: string
          datum?: string
          drank_id: string
          factuur_id?: string | null
          id?: string
          period_id?: string | null
          user_id: string
          user_naam?: string | null
        }
        Update: {
          aantal?: number
          created_at?: string
          datum?: string
          drank_id?: string
          factuur_id?: string | null
          id?: string
          period_id?: string | null
          user_id?: string
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumpties_drank_id_fkey"
            columns: ["drank_id"]
            isOneToOne: false
            referencedRelation: "dranken"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_factuur_id_fkey"
            columns: ["factuur_id"]
            isOneToOne: false
            referencedRelation: "admin_facturen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_factuur_id_fkey"
            columns: ["factuur_id"]
            isOneToOne: false
            referencedRelation: "facturen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countdowns: {
        Row: {
          id: string
          target_date: string
          title: string
        }
        Insert: {
          id: string
          target_date: string
          title: string
        }
        Update: {
          id?: string
          target_date?: string
          title?: string
        }
        Relationships: []
      }
      dranken: {
        Row: {
          categorie: string
          created_at: string
          huidige_voorraad: number
          id: string
          is_temporary: boolean
          naam: string
          prijs: number
          valid_until: string | null
        }
        Insert: {
          categorie?: string
          created_at?: string
          huidige_voorraad?: number
          id?: string
          is_temporary?: boolean
          naam: string
          prijs: number
          valid_until?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string
          huidige_voorraad?: number
          id?: string
          is_temporary?: boolean
          naam?: string
          prijs?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          beschrijving: string | null
          created_at: string
          datum: string
          end_time: string | null
          id: string
          locatie: string
          responsible: string | null
          start_time: string | null
          tijd: string
          titel: string
          type: string | null
        }
        Insert: {
          beschrijving?: string | null
          created_at?: string
          datum: string
          end_time?: string | null
          id?: string
          locatie: string
          responsible?: string | null
          start_time?: string | null
          tijd: string
          titel: string
          type?: string | null
        }
        Update: {
          beschrijving?: string | null
          created_at?: string
          datum?: string
          end_time?: string | null
          id?: string
          locatie?: string
          responsible?: string | null
          start_time?: string | null
          tijd?: string
          titel?: string
          type?: string | null
        }
        Relationships: []
      }
      facturen: {
        Row: {
          created_at: string
          id: string
          periode: string
          status: Database["public"]["Enums"]["factuur_status"]
          totaal_bedrag: number
          user_id: string
          user_naam: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          periode: string
          status?: Database["public"]["Enums"]["factuur_status"]
          totaal_bedrag: number
          user_id: string
          user_naam?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          periode?: string
          status?: Database["public"]["Enums"]["factuur_status"]
          totaal_bedrag?: number
          user_id?: string
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frituur_bestellingen: {
        Row: {
          created_at: string
          id: string
          items: Json | null
          opmerking: string | null
          period_id: string | null
          saus: string | null
          sessie_id: string | null
          snack_naam: string
          status: Database["public"]["Enums"]["frituur_status"]
          totaal_prijs: number | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json | null
          opmerking?: string | null
          period_id?: string | null
          saus?: string | null
          sessie_id?: string | null
          snack_naam: string
          status?: Database["public"]["Enums"]["frituur_status"]
          totaal_prijs?: number | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json | null
          opmerking?: string | null
          period_id?: string | null
          saus?: string | null
          sessie_id?: string | null
          snack_naam?: string
          status?: Database["public"]["Enums"]["frituur_status"]
          totaal_prijs?: number | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frituur_bestellingen_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frituur_bestellingen_sessie_id_fkey"
            columns: ["sessie_id"]
            isOneToOne: false
            referencedRelation: "frituur_sessies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frituur_bestellingen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frituur_items: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price: number
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      frituur_sessies: {
        Row: {
          actual_amount: number | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          pickup_time: string | null
          receipt_url: string | null
          status: string
        }
        Insert: {
          actual_amount?: number | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pickup_time?: string | null
          receipt_url?: string | null
          status?: string
        }
        Update: {
          actual_amount?: number | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pickup_time?: string | null
          receipt_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "frituur_sessies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inkoop_facturen: {
        Row: {
          bedrag: number
          bestand_url: string | null
          created_at: string
          created_by: string | null
          datum: string
          id: string
          leverancier: string
          period_id: string | null
        }
        Insert: {
          bedrag: number
          bestand_url?: string | null
          created_at?: string
          created_by?: string | null
          datum: string
          id?: string
          leverancier: string
          period_id?: string | null
        }
        Update: {
          bedrag?: number
          bestand_url?: string | null
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          leverancier?: string
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inkoop_facturen_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inkoop_facturen_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaties: {
        Row: {
          action: string | null
          bericht: string | null
          created_at: string
          datum: string
          gelezen: boolean
          id: string
          ontvanger_id: string
          titel: string
          zender_id: string
          zender_naam: string | null
        }
        Insert: {
          action?: string | null
          bericht?: string | null
          created_at?: string
          datum?: string
          gelezen?: boolean
          id?: string
          ontvanger_id: string
          titel: string
          zender_id: string
          zender_naam?: string | null
        }
        Update: {
          action?: string | null
          bericht?: string | null
          created_at?: string
          datum?: string
          gelezen?: boolean
          id?: string
          ontvanger_id?: string
          titel?: string
          zender_id?: string
          zender_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaties_zender_id_fkey"
            columns: ["zender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          actief: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          naam: string
          nickname: string | null
          quick_drink_id: string | null
          rol: Database["public"]["Enums"]["user_role"]
          roles: string[] | null
        }
        Insert: {
          actief?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          naam: string
          nickname?: string | null
          quick_drink_id?: string | null
          rol?: Database["public"]["Enums"]["user_role"]
          roles?: string[] | null
        }
        Update: {
          actief?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          naam?: string
          nickname?: string | null
          quick_drink_id?: string | null
          rol?: Database["public"]["Enums"]["user_role"]
          roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_quick_drink"
            columns: ["quick_drink_id"]
            isOneToOne: false
            referencedRelation: "dranken"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_votes: {
        Row: {
          created_at: string
          id: string
          quote_id: string
          user_id: string
          user_naam: string | null
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_id: string
          user_id: string
          user_naam?: string | null
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_id?: string
          user_id?: string
          user_naam?: string | null
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_votes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          auteur: string
          context: string | null
          created_at: string
          datum: string
          id: string
          tekst: string
          toegevoegd_door: string | null
          upvotes: number
        }
        Insert: {
          auteur: string
          context?: string | null
          created_at?: string
          datum?: string
          id?: string
          tekst: string
          toegevoegd_door?: string | null
          upvotes?: number
        }
        Update: {
          auteur?: string
          context?: string | null
          created_at?: string
          datum?: string
          id?: string
          tekst?: string
          toegevoegd_door?: string | null
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_toegevoegd_door_fkey"
            columns: ["toegevoegd_door"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      shop_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          stock: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          stock?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string | null
          color: string | null
          count: number
          created_at: string
          expiry_date: string | null
          icon: string | null
          id: string
          label: string | null
          name: string
          unit: string | null
          urgent: boolean | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          count?: number
          created_at?: string
          expiry_date?: string | null
          icon?: string | null
          id?: string
          label?: string | null
          name: string
          unit?: string | null
          urgent?: boolean | null
        }
        Update: {
          category?: string | null
          color?: string | null
          count?: number
          created_at?: string
          expiry_date?: string | null
          icon?: string | null
          id?: string
          label?: string | null
          name?: string
          unit?: string | null
          urgent?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_billing_corrections: {
        Row: {
          correctie_bedrag: number | null
          created_at: string | null
          id: string | null
          notitie: string | null
          period_id: string | null
          user_id: string | null
          user_naam: string | null
        }
        Insert: {
          correctie_bedrag?: number | null
          created_at?: string | null
          id?: string | null
          notitie?: string | null
          period_id?: string | null
          user_id?: string | null
          user_naam?: string | null
        }
        Update: {
          correctie_bedrag?: number | null
          created_at?: string | null
          id?: string | null
          notitie?: string | null
          period_id?: string | null
          user_id?: string | null
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_corrections_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_consumpties: {
        Row: {
          aantal: number | null
          created_at: string | null
          datum: string | null
          drank_id: string | null
          drank_naam: string | null
          factuur_id: string | null
          id: string | null
          period_id: string | null
          user_id: string | null
          user_naam: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumpties_drank_id_fkey"
            columns: ["drank_id"]
            isOneToOne: false
            referencedRelation: "dranken"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_factuur_id_fkey"
            columns: ["factuur_id"]
            isOneToOne: false
            referencedRelation: "admin_facturen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_factuur_id_fkey"
            columns: ["factuur_id"]
            isOneToOne: false
            referencedRelation: "facturen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumpties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_facturen: {
        Row: {
          created_at: string | null
          id: string | null
          periode: string | null
          status: Database["public"]["Enums"]["factuur_status"] | null
          totaal_bedrag: number | null
          user_id: string | null
          user_naam: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          periode?: string | null
          status?: Database["public"]["Enums"]["factuur_status"] | null
          totaal_bedrag?: number | null
          user_id?: string | null
          user_naam?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          periode?: string | null
          status?: Database["public"]["Enums"]["factuur_status"] | null
          totaal_bedrag?: number | null
          user_id?: string | null
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_frituur_bestellingen: {
        Row: {
          created_at: string | null
          id: string | null
          period_id: string | null
          sessie_id: string | null
          snack_naam: string | null
          status: Database["public"]["Enums"]["frituur_status"] | null
          totaal_prijs: number | null
          user_id: string | null
          user_naam: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          period_id?: string | null
          sessie_id?: string | null
          snack_naam?: string | null
          status?: Database["public"]["Enums"]["frituur_status"] | null
          totaal_prijs?: number | null
          user_id?: string | null
          user_naam?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          period_id?: string | null
          sessie_id?: string | null
          snack_naam?: string | null
          status?: Database["public"]["Enums"]["frituur_status"] | null
          totaal_prijs?: number | null
          user_id?: string | null
          user_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frituur_bestellingen_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frituur_bestellingen_sessie_id_fkey"
            columns: ["sessie_id"]
            isOneToOne: false
            referencedRelation: "frituur_sessies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frituur_bestellingen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notificaties: {
        Row: {
          bericht: string | null
          created_at: string | null
          datum: string | null
          gelezen: boolean | null
          id: string | null
          ontvanger_id: string | null
          titel: string | null
          zender_id: string | null
          zender_naam: string | null
        }
        Insert: {
          bericht?: string | null
          created_at?: string | null
          datum?: string | null
          gelezen?: boolean | null
          id?: string | null
          ontvanger_id?: string | null
          titel?: string | null
          zender_id?: string | null
          zender_naam?: string | null
        }
        Update: {
          bericht?: string | null
          created_at?: string | null
          datum?: string | null
          gelezen?: boolean | null
          id?: string | null
          ontvanger_id?: string | null
          titel?: string | null
          zender_id?: string | null
          zender_naam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaties_zender_id_fkey"
            columns: ["zender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_consumpties_period: { Args: never; Returns: Json }
      streep_drank: {
        Args: {
          p_aantal: number
          p_drank_id: string
          p_period_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      factuur_status: "betaald" | "onbetaald"
      frituur_status: "open" | "besteld" | "geleverd"
      user_role:
        | "admin"
        | "team_drank"
        | "standaard"
        | "sfeerbeheer"
        | "godmode"
        | "team drank"
        | "hoofdleiding"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      factuur_status: ["betaald", "onbetaald"],
      frituur_status: ["open", "besteld", "geleverd"],
      user_role: [
        "admin",
        "team_drank",
        "standaard",
        "sfeerbeheer",
        "godmode",
        "team drank",
        "hoofdleiding",
      ],
    },
  },
} as const
