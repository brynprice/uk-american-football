export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      competitions: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          level: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          level?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          level?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      seasons: {
        Row: {
          id: string
          competition_id: string
          year: number
          name: string | null
          start_date: string | null
          end_date: string | null
          confidence_level: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competition_id: string
          year: number
          name?: string | null
          start_date?: string | null
          end_date?: string | null
          confidence_level?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          competition_id?: string
          year?: number
          name?: string | null
          start_date?: string | null
          end_date?: string | null
          confidence_level?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      phases: {
        Row: {
          id: string
          season_id: string
          parent_phase_id: string | null
          name: string
          type: string | null
          ordinal: number
          confidence_level: string
          max_games_per_team: number | null
          games_validated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          season_id: string
          parent_phase_id?: string | null
          name: string
          type?: string | null
          ordinal?: number
          confidence_level?: string
          max_games_per_team?: number | null
          games_validated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          season_id?: string
          parent_phase_id?: string | null
          name?: string
          type?: string | null
          ordinal?: number
          confidence_level?: string
          max_games_per_team?: number | null
          games_validated?: boolean
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          location: string | null
          founded_year: number | null
          folded_year: number | null
          notes: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          founded_year?: number | null
          folded_year?: number | null
          notes?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          founded_year?: number | null
          folded_year?: number | null
          notes?: string | null
          logo_url?: string | null
          created_at?: string
        }
      }
      team_aliases: {
        Row: {
          id: string
          team_id: string
          name: string
          start_year: number | null
          end_year: number | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          start_year?: number | null
          end_year?: number | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          start_year?: number | null
          end_year?: number | null
          logo_url?: string | null
          created_at?: string
        }
      }
      people: {
        Row: {
          id: string
          display_name: string
          first_name: string | null
          last_name: string | null
          bio: string | null
          created_at: string
        }
        Insert: {
          id?: string
          display_name: string
          first_name?: string | null
          last_name?: string | null
          bio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          first_name?: string | null
          last_name?: string | null
          bio?: string | null
          created_at?: string
        }
      }
      games: {
        Row: {
          id: string
          phase_id: string
          home_team_id: string
          away_team_id: string
          home_score: number | null
          away_score: number | null
          game_type: string
          season_id: string | null
          date: string | null
          date_precision: string
          date_display: string | null
          time: string | null
          venue_id: string | null
          status: string
          is_playoff: boolean
          is_double_header: boolean
          notes: string | null
          confidence_level: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phase_id: string
          home_team_id: string
          away_team_id: string
          home_score?: number | null
          away_score?: number | null
          game_type?: string
          season_id?: string | null
          date?: string | null
          date_precision?: string
          date_display?: string | null
          time?: string | null
          venue_id?: string | null
          status?: string
          is_playoff?: boolean
          is_double_header?: boolean
          notes?: string | null
          confidence_level?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phase_id?: string
          home_team_id?: string
          away_team_id?: string
          home_score?: number | null
          away_score?: number | null
          game_type?: string
          season_id?: string | null
          date?: string | null
          date_precision?: string
          date_display?: string | null
          time?: string | null
          venue_id?: string | null
          status?: string
          is_playoff?: boolean
          is_double_header?: boolean
          notes?: string | null
          confidence_level?: string
          created_at?: string
          updated_at?: string
        }
      }
      venues: {
        Row: {
          id: string
          name: string
          city: string | null
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          city?: string | null
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string | null
          address?: string | null
          created_at?: string
        }
      }
      game_staff: {
        Row: {
          id: string
          game_id: string
          team_id: string
          person_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          team_id: string
          person_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          team_id?: string
          person_id?: string
          role?: string
          created_at?: string
        }
      }
      sources: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          url: string | null
          description: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          url?: string | null
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          url?: string | null
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          content?: string
          created_at?: string
        }
      },
      participations: {
        Row: {
          id: string
          phase_id: string
          team_id: string
          head_coach_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          phase_id: string
          team_id: string
          head_coach_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          phase_id?: string
          team_id?: string
          head_coach_id?: string | null
          notes?: string | null
          created_at?: string
        }
      }
    }
  }
}
