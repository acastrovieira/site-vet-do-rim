/**
 * Tipos TypeScript gerados a partir do schema Supabase (Vete do Rim)
 * Tabelas cobertas: profiles, tutores, pets, colaboradores
 * Atualizado em: 2026-05-15
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'vet' | 'tutor' | 'admin'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          document: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          role: UserRole
          full_name?: string | null
          document?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string | null
          document?: string | null
          created_at?: string | null
        }
      }
      tutores: {
        Row: {
          id: string
          nome: string
          cpf: string | null
          telefone: string
          email: string | null
          cep: string | null
          endereco: string | null
          cidade: string | null
          estado: string | null
          lgpd_aceito_em: string | null
          lgpd_ip: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          cpf?: string | null
          telefone: string
          email?: string | null
          cep?: string | null
          endereco?: string | null
          cidade?: string | null
          estado?: string | null
          lgpd_aceito_em?: string | null
          lgpd_ip?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['tutores']['Insert']>
      }
      pets: {
        Row: {
          id: string
          tutor_id: string
          nome: string
          especie: string
          raca: string | null
          idade_anos: number | null
          idade_meses: number | null
          peso_atual: number | null
          status_paciente: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          tutor_id: string
          nome: string
          especie: string
          raca?: string | null
          idade_anos?: number | null
          idade_meses?: number | null
          peso_atual?: number | null
          status_paciente?: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['pets']['Insert']>
      }
      colaboradores: {
        Row: {
          id: string
          supabase_uid: string | null
          nome: string
          email: string
          cargo: string
          nivel_acesso: string
          crmv: string | null
          telefone: string | null
          ativo: boolean
          termos_aceitos_em: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          supabase_uid?: string | null
          nome: string
          email: string
          cargo: string
          nivel_acesso: string
          crmv?: string | null
          telefone?: string | null
          ativo?: boolean
          termos_aceitos_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
