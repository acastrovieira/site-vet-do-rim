/**
 * Tipos TypeScript para o schema Supabase (Vet do Rim).
 * Tabelas cobertas: profiles, tutores, pets, triagens, follow_ups,
 * colaboradores, laudos_pdf, clinics, clinic_memberships.
 * Atualizado em: 2026-05-15 (base) + 2026-07-19 (tenancy Fase 1.5).
 *
 * ATENCAO (ADR-001 §6.4 / docs/architecture/fase1-tenancy-implementation-spec.md
 * §5.4): os tipos de tenancy abaixo (clinics, clinic_memberships, e as colunas
 * clinic_id/created_by nas tabelas legadas) foram escritos a mao a partir das
 * migrations `20260718100000_tenancy_expand.sql` e
 * `20260718100100_tenancy_backfill_default_clinic.sql`. NAO sao gerados pela
 * CLI do Supabase. Este arquivo inteiro deve ser regenerado a partir do schema
 * real (`supabase gen types typescript`) assim que o db-sage rodar isso contra
 * o projeto efemero/remoto — nao remover esta nota ate a regeneracao ocorrer.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'vet' | 'tutor' | 'admin'

// 'abandonado' foi adicionado em 20260718120000_laudo_upload_reservation.sql
// (Tarefa 2.5): compensacao deterministica de uma reserva de upload nunca
// concluida por private.abandon_laudo_upload.
export type LaudoStatus = 'pendente' | 'processando' | 'concluido' | 'erro' | 'abandonado'

// ADR-001 tenancy — ver supabase/migrations/20260718100000_tenancy_expand.sql
export type ClinicStatus = 'active' | 'suspended'
export type ClinicMembershipRole = 'clinic_admin' | 'vet' | 'recepcao'
export type ClinicMembershipStatus = 'active' | 'inactive'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          document: string | null
          phone: string | null
          address: string | null
          ai_quota_limit: number | null
          ai_quota_used: number | null
          ai_quota_reset_date: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          role: UserRole
          full_name?: string | null
          document?: string | null
          phone?: string | null
          address?: string | null
          ai_quota_limit?: number | null
          ai_quota_used?: number | null
          ai_quota_reset_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string | null
          document?: string | null
          phone?: string | null
          address?: string | null
          ai_quota_limit?: number | null
          ai_quota_used?: number | null
          ai_quota_reset_date?: string | null
          created_at?: string | null
        }
        Relationships: []
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
          // ADR-001 tenancy: nullable ate o backfill+enforce remoto rodarem.
          clinic_id: string | null
          created_by: string | null
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
          clinic_id?: string | null
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['tutores']['Insert']>
        Relationships: []
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
          data_obito: string | null
          clinic_id: string | null
          created_by: string | null
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
          data_obito?: string | null
          clinic_id?: string | null
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['pets']['Insert']>
        Relationships: []
      }
      triagens: {
        Row: {
          id: string
          pet_id: string
          tutor_id: string | null
          status: string
          observacoes: string | null
          clinic_id: string | null
          created_by: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          pet_id: string
          tutor_id?: string | null
          status?: string
          observacoes?: string | null
          clinic_id?: string | null
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['triagens']['Insert']>
        Relationships: []
      }
      follow_ups: {
        Row: {
          id: string
          triagem_id: string
          opt_out: boolean
          canal: string | null
          scheduled_at: string | null
          sent_at: string | null
          clinic_id: string | null
          created_by: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          triagem_id: string
          opt_out?: boolean
          canal?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          clinic_id?: string | null
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['follow_ups']['Insert']>
        Relationships: []
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
          clinic_id: string | null
          created_by: string | null
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
          clinic_id?: string | null
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>
        Relationships: []
      }
      laudos_pdf: {
        Row: {
          id: string
          pet_id: string
          vet_id: string | null
          storage_path: string
          nome_arquivo: string
          tipo_exame: string
          status: LaudoStatus
          resultado_ia: Json | null
          erro_ia: string | null
          tamanho_bytes: number | null
          clinic_id: string | null
          created_by: string | null
          // Tarefa 2.5 (20260718120000): trilha de compensacao de reserva.
          abandoned_at: string | null
          abandoned_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pet_id: string
          vet_id?: string | null
          storage_path: string
          nome_arquivo: string
          tipo_exame?: string
          status?: LaudoStatus
          resultado_ia?: Json | null
          erro_ia?: string | null
          tamanho_bytes?: number | null
          clinic_id?: string | null
          created_by?: string | null
          abandoned_at?: string | null
          abandoned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['laudos_pdf']['Insert']>
        Relationships: []
      }
      // ADR-001 tenant root — supabase/migrations/20260718100000_tenancy_expand.sql
      clinics: {
        Row: {
          id: string
          nome: string
          status: ClinicStatus
          created_by: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          status?: ClinicStatus
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['clinics']['Insert']>
        Relationships: []
      }
      // ADR-001 authorization source — profiles.role deixa de ser a fronteira
      // quando o enforce ligar; ate la, coexiste com a checagem por papel.
      clinic_memberships: {
        Row: {
          clinic_id: string
          user_id: string
          role: ClinicMembershipRole
          status: ClinicMembershipStatus
          created_by: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          clinic_id: string
          user_id: string
          role: ClinicMembershipRole
          status?: ClinicMembershipStatus
          created_by?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: Partial<Database['public']['Tables']['clinic_memberships']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    // Tarefa 2.5 (20260718120000_laudo_upload_reservation.sql): as duas RPCs
    // de reserva/abandono chamadas diretamente pelo browser autenticado (via
    // API Next.js server-side) — ao contrario de claim/finalize/refund
    // (somente service_role, tipadas separadamente em
    // supabase/functions/parse-laudo/database.types.ts).
    Functions: {
      reserve_laudo_upload: {
        Args: { p_pet_id: string }
        Returns: { laudo_id: string; storage_bucket: string; storage_path: string }[]
      }
      abandon_laudo_upload: {
        Args: { p_laudo_id: string }
        Returns: { disposition: string; storage_bucket: string | null; storage_path: string | null }[]
      }
    }
    Enums: Record<string, never>
  }
}
