-- Adiciona colunas para controle de uso de Inteligência Artificial por usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_quota_limit INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS ai_quota_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_quota_reset_date TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.ai_quota_limit IS 'Limite mensal gratuito de uso de IA (ex: leitura de PDFs)';
COMMENT ON COLUMN public.profiles.ai_quota_used IS 'Quantidade de usos de IA no ciclo atual';
COMMENT ON COLUMN public.profiles.ai_quota_reset_date IS 'Data em que a cota será zerada (ex: renovação mensal)';