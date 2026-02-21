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
      atividades: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          descricao: string | null
          fazenda_id: number
          funcionarios: Json | null
          id: number
          maquinarios: Json | null
          prioridade: Database["public"]["Enums"]["atividade_prioridade"] | null
          produtos: Json | null
          safra_id: number | null
          situacao: Database["public"]["Enums"]["atividade_situacao"] | null
          talhao_ids: number[] | null
          tipo: Database["public"]["Enums"]["atividade_tipo"] | null
          titulo: string
          updated_at: string
          usuario_responsavel_id: string | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          fazenda_id: number
          funcionarios?: Json | null
          id?: number
          maquinarios?: Json | null
          prioridade?:
            | Database["public"]["Enums"]["atividade_prioridade"]
            | null
          produtos?: Json | null
          safra_id?: number | null
          situacao?: Database["public"]["Enums"]["atividade_situacao"] | null
          talhao_ids?: number[] | null
          tipo?: Database["public"]["Enums"]["atividade_tipo"] | null
          titulo: string
          updated_at?: string
          usuario_responsavel_id?: string | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          fazenda_id?: number
          funcionarios?: Json | null
          id?: number
          maquinarios?: Json | null
          prioridade?:
            | Database["public"]["Enums"]["atividade_prioridade"]
            | null
          produtos?: Json | null
          safra_id?: number | null
          situacao?: Database["public"]["Enums"]["atividade_situacao"] | null
          talhao_ids?: number[] | null
          tipo?: Database["public"]["Enums"]["atividade_tipo"] | null
          titulo?: string
          updated_at?: string
          usuario_responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividades_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      embrapa_recomendacoes: {
        Row: {
          created_at: string | null
          culturas_alvo: string[] | null
          descricao: string | null
          id: number
          nome_cientifico: string | null
          nome_praga: string
          produtos_recomendados: Json | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          culturas_alvo?: string[] | null
          descricao?: string | null
          id?: never
          nome_cientifico?: string | null
          nome_praga: string
          produtos_recomendados?: Json | null
          tipo?: string
        }
        Update: {
          created_at?: string | null
          culturas_alvo?: string[] | null
          descricao?: string | null
          id?: never
          nome_cientifico?: string | null
          nome_praga?: string
          produtos_recomendados?: Json | null
          tipo?: string
        }
        Relationships: []
      }
      fazendas: {
        Row: {
          area_total: number | null
          center_lat: number | null
          center_lng: number | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          estado: string | null
          id: number
          nome: string
          owner_id: string | null
          saude: Json | null
          saude_updated_at: string | null
          updated_at: string
        }
        Insert: {
          area_total?: number | null
          center_lat?: number | null
          center_lng?: number | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          estado?: string | null
          id?: number
          nome: string
          owner_id?: string | null
          saude?: Json | null
          saude_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          area_total?: number | null
          center_lat?: number | null
          center_lng?: number | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          estado?: string | null
          id?: number
          nome?: string
          owner_id?: string | null
          saude?: Json | null
          saude_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fazendas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_reference_vectors: {
        Row: {
          caracteristicas_chave: Json | null
          confianca: number | null
          created_at: string
          created_by: string | null
          descricao_visual: string | null
          embedding: string | null
          fonte: string
          icone_url: string | null
          id: number
          imagem_referencia_url: string | null
          nome_cientifico: string | null
          nome_praga: string
          tipo: string
          updated_at: string
        }
        Insert: {
          caracteristicas_chave?: Json | null
          confianca?: number | null
          created_at?: string
          created_by?: string | null
          descricao_visual?: string | null
          embedding?: string | null
          fonte?: string
          icone_url?: string | null
          id?: number
          imagem_referencia_url?: string | null
          nome_cientifico?: string | null
          nome_praga: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          caracteristicas_chave?: Json | null
          confianca?: number | null
          created_at?: string
          created_by?: string | null
          descricao_visual?: string | null
          embedding?: string | null
          fonte?: string
          icone_url?: string | null
          id?: number
          imagem_referencia_url?: string | null
          nome_cientifico?: string | null
          nome_praga?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      safras: {
        Row: {
          ativa: boolean
          created_at: string
          cultura_descricao: string | null
          data_fim: string | null
          data_inicio: string | null
          fazenda_id: number
          id: number
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          cultura_descricao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fazenda_id: number
          id?: number
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          cultura_descricao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fazenda_id?: number
          id?: number
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safras_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_pragas: {
        Row: {
          contagem: number | null
          coordinates: Json | null
          data_contagem: string | null
          data_marcacao: string | null
          embrapa_recomendacao_id: number | null
          id: number
          imagem_url: string | null
          observacao: string | null
          praga_nome: string | null
          presenca: boolean | null
          prioridade: string | null
          recomendacao: string | null
          scout_id: number
          tipo_praga: string | null
        }
        Insert: {
          contagem?: number | null
          coordinates?: Json | null
          data_contagem?: string | null
          data_marcacao?: string | null
          embrapa_recomendacao_id?: number | null
          id?: number
          imagem_url?: string | null
          observacao?: string | null
          praga_nome?: string | null
          presenca?: boolean | null
          prioridade?: string | null
          recomendacao?: string | null
          scout_id: number
          tipo_praga?: string | null
        }
        Update: {
          contagem?: number | null
          coordinates?: Json | null
          data_contagem?: string | null
          data_marcacao?: string | null
          embrapa_recomendacao_id?: number | null
          id?: number
          imagem_url?: string | null
          observacao?: string | null
          praga_nome?: string | null
          presenca?: boolean | null
          prioridade?: string | null
          recomendacao?: string | null
          scout_id?: number
          tipo_praga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_pragas_embrapa_recomendacao_id_fkey"
            columns: ["embrapa_recomendacao_id"]
            isOneToOne: false
            referencedRelation: "embrapa_recomendacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_pragas_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      scouts: {
        Row: {
          created_at: string
          fazenda_id: number
          id: number
          imagem_url: string | null
          markers_visitados: number | null
          nome: string
          observacao: string | null
          status: string | null
          talhao_id: number | null
          total_markers: number | null
          total_pragas: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fazenda_id: number
          id?: number
          imagem_url?: string | null
          markers_visitados?: number | null
          nome: string
          observacao?: string | null
          status?: string | null
          talhao_id?: number | null
          total_markers?: number | null
          total_pragas?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fazenda_id?: number
          id?: number
          imagem_url?: string | null
          markers_visitados?: number | null
          nome?: string
          observacao?: string | null
          status?: string | null
          talhao_id?: number | null
          total_markers?: number | null
          total_pragas?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scouts_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouts_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      talhao_infestacao_historico: {
        Row: {
          created_at: string
          data: string
          id: number
          percentual_infestacao: number
          talhao_id: number
        }
        Insert: {
          created_at?: string
          data: string
          id?: number
          percentual_infestacao?: number
          talhao_id: number
        }
        Update: {
          created_at?: string
          data?: string
          id?: number
          percentual_infestacao?: number
          talhao_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "talhao_infestacao_historico_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      talhoes: {
        Row: {
          area: number | null
          color: string | null
          coordinates: Json | null
          created_at: string
          cultura_atual: Database["public"]["Enums"]["cultura_talhao_enum"]
          fazenda_id: number
          id: number
          nome: string
          percentual_infestacao: number | null
          updated_at: string
        }
        Insert: {
          area?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string
          cultura_atual?: Database["public"]["Enums"]["cultura_talhao_enum"]
          fazenda_id: number
          id?: number
          nome: string
          percentual_infestacao?: number | null
          updated_at?: string
        }
        Update: {
          area?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string
          cultura_atual?: Database["public"]["Enums"]["cultura_talhao_enum"]
          fazenda_id?: number
          id?: number
          nome?: string
          percentual_infestacao?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talhoes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fazendas: {
        Row: {
          created_at: string
          fazenda_id: number
          id: number
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fazenda_id: number
          id?: number
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fazenda_id?: number
          id?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fazendas_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_fazendas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_farm_health_data: { Args: { p_fazenda_id?: number }; Returns: Json }
      get_talhao_monitoramento_detail: {
        Args: { p_month_start?: string; p_talhao_id: number }
        Returns: Json
      }
      point_in_talhao_polygon: {
        Args: { coords: Json; p_lat: number; p_lng: number }
        Returns: boolean
      }
      recalc_fazenda_saude: {
        Args: { p_fazenda_id: number }
        Returns: undefined
      }
      recalc_talhao_percentual_infestacao: {
        Args: { p_talhao_id: number }
        Returns: undefined
      }
    }
    Enums: {
      atividade_prioridade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA"
      atividade_situacao: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA"
      atividade_tipo:
        | "MONITORAMENTO"
        | "APLICACAO"
        | "CONTROLE_PRAGAS"
        | "VERIFICACAO"
        | "PLANTIO"
        | "COLHEITA"
        | "OUTROS"
      cultura_talhao_enum:
        | "TRIGO"
        | "MILHO"
        | "ALGODAO"
        | "SOJA"
        | "CAFE"
        | "FEIJAO"
        | "OUTROS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

/** Enum de cultura do talhão para ícones e padrão no app */
export type CulturaTalhaoEnum = Database['public']['Enums']['cultura_talhao_enum']

/** Rótulo para exibição da cultura (cultura_atual é enum no banco) */
export const CULTURA_TALHAO_LABEL: Record<CulturaTalhaoEnum, string> = {
  TRIGO: 'Trigo',
  MILHO: 'Milho',
  ALGODAO: 'Algodão',
  SOJA: 'Soja',
  CAFE: 'Café',
  FEIJAO: 'Feijão',
  OUTROS: 'Outros',
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
      atividade_prioridade: ["BAIXA", "MEDIA", "ALTA", "CRITICA"],
      atividade_situacao: ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"],
      atividade_tipo: [
        "MONITORAMENTO",
        "APLICACAO",
        "CONTROLE_PRAGAS",
        "VERIFICACAO",
        "PLANTIO",
        "COLHEITA",
        "OUTROS",
      ],
      cultura_talhao_enum: [
        "TRIGO",
        "MILHO",
        "ALGODAO",
        "SOJA",
        "CAFE",
        "FEIJAO",
        "OUTROS",
      ],
    },
  },
} as const
