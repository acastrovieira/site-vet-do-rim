export type ProfileRole = "vet" | "tutor" | "admin";
export type LaudoStatus = "pendente" | "processando" | "concluido" | "erro";
export type JsonObject = Record<string, unknown>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
          ai_quota_used: number | null;
          ai_quota_limit: number | null;
        };
        Insert: {
          id: string;
          role?: ProfileRole;
          ai_quota_used?: number | null;
          ai_quota_limit?: number | null;
        };
        Update: {
          role?: ProfileRole;
          ai_quota_used?: number | null;
          ai_quota_limit?: number | null;
        };
        Relationships: [];
      };
      laudos_pdf: {
        Row: {
          id: string;
          storage_path: string;
          status: LaudoStatus;
          vet_id: string | null;
          resultado_ia: JsonObject | null;
          erro_ia: string | null;
        };
        Insert: {
          id?: string;
          storage_path: string;
          status?: LaudoStatus;
          vet_id?: string | null;
          resultado_ia?: JsonObject | null;
          erro_ia?: string | null;
        };
        Update: {
          status?: LaudoStatus;
          resultado_ia?: JsonObject | null;
          erro_ia?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_ai_quota: {
        Args: { user_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
