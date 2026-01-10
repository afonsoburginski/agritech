/**
 * Tipos gerados automaticamente do Supabase
 * Não edite manualmente - use: mcp_supabase-foxfliedcore_generate_typescript_types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          farm_id: string | null
          id: string
          name: string
          plot_id: string | null
          priority: string | null
          start_date: string | null
          status: string
          synced: boolean | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          farm_id?: string | null
          id?: string
          name: string
          plot_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string
          synced?: boolean | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          farm_id?: string | null
          id?: string
          name?: string
          plot_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string
          synced?: boolean | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          area_hectares: number | null
          code: string | null
          created_at: string | null
          id: string
          location: string | null
          name: string
          owner_id: string | null
          updated_at: string | null
        }
        Insert: {
          area_hectares?: number | null
          code?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Update: {
          area_hectares?: number | null
          code?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      heatmap_points: {
        Row: {
          created_at: string | null
          farm_id: string | null
          id: string
          intensity: number
          latitude: number
          longitude: number
          pest_type: string | null
          plot_id: string | null
          scout_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          farm_id?: string | null
          id?: string
          intensity: number
          latitude: number
          longitude: number
          pest_type?: string | null
          plot_id?: string | null
          scout_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          farm_id?: string | null
          id?: string
          intensity?: number
          latitude?: number
          longitude?: number
          pest_type?: string | null
          plot_id?: string | null
          scout_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heatmap_points_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heatmap_points_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heatmap_points_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      pests: {
        Row: {
          confidence: number | null
          created_at: string | null
          deleted_at: string | null
          id: string
          image_url: string | null
          name: string
          notes: string | null
          quantity: number | null
          scientific_name: string | null
          scout_id: string
          severity: string | null
          synced: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          quantity?: number | null
          scientific_name?: string | null
          scout_id: string
          severity?: string | null
          synced?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          quantity?: number | null
          scientific_name?: string | null
          scout_id?: string
          severity?: string | null
          synced?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pests_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      plots: {
        Row: {
          area_hectares: number | null
          code: string | null
          coordinates: Json | null
          created_at: string | null
          culture: string | null
          farm_id: string
          health_status: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          area_hectares?: number | null
          code?: string | null
          coordinates?: Json | null
          created_at?: string | null
          culture?: string | null
          farm_id: string
          health_status?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          area_hectares?: number | null
          code?: string | null
          coordinates?: Json | null
          created_at?: string | null
          culture?: string | null
          farm_id?: string
          health_status?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      scouts: {
        Row: {
          accuracy: number | null
          altitude: number | null
          created_at: string | null
          deleted_at: string | null
          farm_id: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          observations: string | null
          plot_id: string | null
          speed: number | null
          synced: boolean | null
          updated_at: string | null
          user_id: string | null
          visit_date: string | null
          visited: boolean | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          observations?: string | null
          plot_id?: string | null
          speed?: number | null
          synced?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          visit_date?: string | null
          visited?: boolean | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          observations?: string | null
          plot_id?: string | null
          speed?: number | null
          synced?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          visit_date?: string | null
          visited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "scouts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouts_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          client_timestamp: string | null
          device_id: string | null
          entity_id: string
          entity_type: string
          id: string
          operation: string
          synced_at: string | null
          user_id: string | null
        }
        Insert: {
          client_timestamp?: string | null
          device_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          operation: string
          synced_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_timestamp?: string | null
          device_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          operation?: string
          synced_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
