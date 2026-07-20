export type ProfileRole = "vet" | "tutor" | "admin";
export type LaudoStatus = "pendente" | "processando" | "concluido" | "erro";
export type JsonObject = Record<string, unknown>;

// AUDIT-001 Fase 2 (Tarefas 2.2/2.3): allowlist fechada de error_code aceita por
// refund_laudo_ia (e refletida em claim/finalize) na migration
// 20260718110000_laudo_claim_finalize_refund.sql. Qualquer valor fora desta
// uniao e rejeitado pela RPC com invalid_request — nunca invente um novo aqui
// sem atualizar a migration primeiro (a migration e a fonte de verdade).
export type LaudoIaErrorCode =
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "provider_rejected"
  | "storage_missing"
  | "invalid_pdf"
  | "invalid_provider_response"
  | "invalid_result_schema"
  | "result_too_large"
  | "worker_crashed"
  | "internal_processing_error"
  | "attempts_exhausted";

export type LaudoIaProviderCode = "gemini" | "openai";

export type ClaimLaudoIaRow = {
  claim_id: string | null;
  claim_token: string | null;
  disposition: string;
  attempt_count: number;
  lease_expires_at: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  quota_used: number | null;
  quota_limit: number | null;
};

export type FinalizeRefundLaudoIaRow = {
  disposition: string;
  quota_used: number | null;
  quota_limit: number | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
        };
        Insert: {
          id: string;
          role?: ProfileRole;
        };
        Update: {
          role?: ProfileRole;
        };
        Relationships: [];
      };
      laudos_pdf: {
        Row: {
          id: string;
          storage_path: string;
          status: LaudoStatus;
          vet_id: string | null;
          clinic_id: string | null;
          resultado_ia: JsonObject | null;
          erro_ia: string | null;
          ia_provenance: JsonObject | null;
        };
        Insert: {
          id?: string;
          storage_path: string;
          status?: LaudoStatus;
          vet_id?: string | null;
          clinic_id?: string | null;
          resultado_ia?: JsonObject | null;
          erro_ia?: string | null;
          ia_provenance?: JsonObject | null;
        };
        Update: {
          status?: LaudoStatus;
          resultado_ia?: JsonObject | null;
          erro_ia?: string | null;
          ia_provenance?: JsonObject | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // AUDIT-001 Fase 2 (Tarefas 2.2/2.3): as tres RPCs transacionais substituem o
    // padrao antigo de SELECT de cota + update manual de status +
    // increment_ai_quota (removido desta funcao). RETURNS TABLE sem
    // SetofOptions one-to-one produz um array no cliente; o codigo sempre
    // encadeia .single() para reduzir a linha unica esperada.
    Functions: {
      claim_laudo_ia: {
        Args: {
          p_clinic_id: string;
          p_actor_user_id: string;
          p_laudo_id: string;
          p_idempotency_key: string;
        };
        Returns: ClaimLaudoIaRow[];
      };
      finalize_laudo_ia: {
        Args: {
          p_clinic_id: string;
          p_actor_user_id: string;
          p_laudo_id: string;
          p_claim_id: string;
          p_claim_token: string;
          p_idempotency_key: string;
          p_result: JsonObject;
          p_provider_code: LaudoIaProviderCode;
          p_provenance?: JsonObject | null;
        };
        Returns: FinalizeRefundLaudoIaRow[];
      };
      refund_laudo_ia: {
        Args: {
          p_clinic_id: string;
          p_actor_user_id: string;
          p_laudo_id: string;
          p_claim_id: string;
          p_claim_token: string | null;
          p_idempotency_key: string;
          p_retryable: boolean;
          p_error_code: LaudoIaErrorCode;
        };
        Returns: FinalizeRefundLaudoIaRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
