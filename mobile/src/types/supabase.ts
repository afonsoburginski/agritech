/**
 * Tipos gerados automaticamente do Supabase
 * Não edite manualmente - regenere via MCP: generate_typescript_types
 * Última geração: 2026-02-16
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
      atividade_funcionarios: {
        Row: {
          atividade_id: number
          data_final: string | null
          data_inicial: string | null
          funcionario_cpf: string | null
          funcionario_id: number | null
          funcionario_nome: string | null
          horas_trabalhadas: string | null
          id: number
        }
        Insert: {
          atividade_id: number
          data_final?: string | null
          data_inicial?: string | null
          funcionario_cpf?: string | null
          funcionario_id?: number | null
          funcionario_nome?: string | null
          horas_trabalhadas?: string | null
          id?: number
        }
        Update: {
          atividade_id?: number
          data_final?: string | null
          data_inicial?: string | null
          funcionario_cpf?: string | null
          funcionario_id?: number | null
          funcionario_nome?: string | null
          horas_trabalhadas?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "atividade_funcionarios_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_maquinarios: {
        Row: {
          atividade_id: number
          combustivel_utilizado: number | null
          horas_trabalhadas: string | null
          id: number
          maquinario_id: number | null
          maquinario_nome: string | null
          maquinario_tipo: string | null
        }
        Insert: {
          atividade_id: number
          combustivel_utilizado?: number | null
          horas_trabalhadas?: string | null
          id?: number
          maquinario_id?: number | null
          maquinario_nome?: string | null
          maquinario_tipo?: string | null
        }
        Update: {
          atividade_id?: number
          combustivel_utilizado?: number | null
          horas_trabalhadas?: string | null
          id?: number
          maquinario_id?: number | null
          maquinario_nome?: string | null
          maquinario_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atividade_maquinarios_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_produtos: {
        Row: {
          atividade_id: number
          id: number
          produto_id: number | null
          produto_nome: string | null
          produto_tipo: string | null
          quantidade: number | null
          unidade_medida: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          atividade_id: number
          id?: number
          produto_id?: number | null
          produto_nome?: string | null
          produto_tipo?: string | null
          quantidade?: number | null
          unidade_medida?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          atividade_id?: number
          id?: number
          produto_id?: number | null
          produto_nome?: string | null
          produto_tipo?: string | null
          quantidade?: number | null
          unidade_medida?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atividade_produtos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_talhoes: {
        Row: {
          atividade_id: number
          id: number
          talhao_id: number
        }
        Insert: {
          atividade_id: number
          id?: number
          talhao_id: number
        }
        Update: {
          atividade_id?: number
          id?: number
          talhao_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "atividade_talhoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_talhoes_talhao_id_fkey"
            columns: ["talhao_id"]
            isOneToOne: false
            referencedRelation: "talhoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          codigo: string | null
          created_at: string
          custo_aproximado: number | null
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          descricao: string | null
          etapa: string | null
          fazenda_id: number
          id: number
          prioridade: string | null
          retirar_estoque: boolean | null
          safra_id: number | null
          scout_id: number | null
          sincronizado: boolean | null
          situacao: string | null
          tipo: string | null
          titulo: string
          ultima_sincronizacao: string | null
          updated_at: string
          usuario_responsavel_id: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          custo_aproximado?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          etapa?: string | null
          fazenda_id: number
          id?: number
          prioridade?: string | null
          retirar_estoque?: boolean | null
          safra_id?: number | null
          scout_id?: number | null
          sincronizado?: boolean | null
          situacao?: string | null
          tipo?: string | null
          titulo: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          usuario_responsavel_id?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string
          custo_aproximado?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          etapa?: string | null
          fazenda_id?: number
          id?: number
          prioridade?: string | null
          retirar_estoque?: boolean | null
          safra_id?: number | null
          scout_id?: number | null
          sincronizado?: boolean | null
          situacao?: string | null
          tipo?: string | null
          titulo?: string
          ultima_sincronizacao?: string | null
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
          {
            foreignKeyName: "fk_atividades_scout"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      fazendas: {
        Row: {
          area_total: number | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          estado: string | null
          id: number
          nome: string
          updated_at: string
        }
        Insert: {
          area_total?: number | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          estado?: string | null
          id?: number
          nome: string
          updated_at?: string
        }
        Update: {
          area_total?: number | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          estado?: string | null
          id?: number
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
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
      scout_marker_pragas: {
        Row: {
          contagem: number | null
          data_contagem: string | null
          estadio_fenologico: string | null
          id: number
          limiar_por_estadio: string | null
          marker_id: number
          observacao: string | null
          praga_id: number | null
          praga_nome: string | null
          praga_nome_cientifico: string | null
          presenca: boolean | null
          prioridade: string | null
          tipo_praga: string | null
          unidade_contagem: string | null
          unidade_fenologica: string | null
        }
        Insert: {
          contagem?: number | null
          data_contagem?: string | null
          estadio_fenologico?: string | null
          id?: number
          limiar_por_estadio?: string | null
          marker_id: number
          observacao?: string | null
          praga_id?: number | null
          praga_nome?: string | null
          praga_nome_cientifico?: string | null
          presenca?: boolean | null
          prioridade?: string | null
          tipo_praga?: string | null
          unidade_contagem?: string | null
          unidade_fenologica?: string | null
        }
        Update: {
          contagem?: number | null
          data_contagem?: string | null
          estadio_fenologico?: string | null
          id?: number
          limiar_por_estadio?: string | null
          marker_id?: number
          observacao?: string | null
          praga_id?: number | null
          praga_nome?: string | null
          praga_nome_cientifico?: string | null
          presenca?: boolean | null
          prioridade?: string | null
          tipo_praga?: string | null
          unidade_contagem?: string | null
          unidade_fenologica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_marker_pragas_marker_id_fkey"
            columns: ["marker_id"]
            isOneToOne: false
            referencedRelation: "scout_markers"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_markers: {
        Row: {
          created_at: string
          data_marcacao: string | null
          id: number
          latitude: string
          longitude: string
          numero: number
          scout_id: number
          updated_at: string
          visitado: boolean | null
        }
        Insert: {
          created_at?: string
          data_marcacao?: string | null
          id?: number
          latitude: string
          longitude: string
          numero: number
          scout_id: number
          updated_at?: string
          visitado?: boolean | null
        }
        Update: {
          created_at?: string
          data_marcacao?: string | null
          id?: number
          latitude?: string
          longitude?: string
          numero?: number
          scout_id?: number
          updated_at?: string
          visitado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_markers_scout_id_fkey"
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
          deleted_at: string | null
          fazenda_id: number
          id: number
          markers_visitados: number | null
          nome: string
          observacao: string | null
          percentual_infestacao: number | null
          sincronizado: boolean | null
          status: string | null
          talhao_id: number | null
          total_markers: number | null
          total_pragas: number | null
          ultima_sincronizacao: string | null
          updated_at: string
          usuario_responsavel_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fazenda_id: number
          id?: number
          markers_visitados?: number | null
          nome: string
          observacao?: string | null
          percentual_infestacao?: number | null
          sincronizado?: boolean | null
          status?: string | null
          talhao_id?: number | null
          total_markers?: number | null
          total_pragas?: number | null
          ultima_sincronizacao?: string | null
          updated_at?: string
          usuario_responsavel_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fazenda_id?: number
          id?: number
          markers_visitados?: number | null
          nome?: string
          observacao?: string | null
          percentual_infestacao?: number | null
          sincronizado?: boolean | null
          status?: string | null
          talhao_id?: number | null
          total_markers?: number | null
          total_pragas?: number | null
          ultima_sincronizacao?: string | null
          updated_at?: string
          usuario_responsavel_id?: string | null
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
          {
            foreignKeyName: "scouts_usuario_responsavel_id_fkey"
            columns: ["usuario_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          cultura_atual: string | null
          fazenda_id: number
          id: number
          nome: string
          updated_at: string
        }
        Insert: {
          area?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string
          cultura_atual?: string | null
          fazenda_id: number
          id?: number
          nome: string
          updated_at?: string
        }
        Update: {
          area?: number | null
          color?: string | null
          coordinates?: Json | null
          created_at?: string
          cultura_atual?: string | null
          fazenda_id?: number
          id?: number
          nome?: string
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
