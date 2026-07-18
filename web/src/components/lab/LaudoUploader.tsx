'use client'

import { useState, useCallback, useTransition, useEffect, useId, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveLaudoFunctionFailure } from '@/lib/lab/function-error'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Zap, FlaskConical, MessageCircle
} from 'lucide-react'

interface HemogramaResult {
  paciente: {
    nome: string; especie: string; raca: string; idade: string
    peso_kg: number | null; tutor: string
  }
  serie_vermelha: {
    hemacias: number | null; hemoglobina: number | null
    hematocrito: number | null; vcm: number | null
    hcm: number | null; chcm: number | null; rdw: number | null
  }
  serie_branca: {
    leucocitos_totais: number | null; neutrofilos_segmentados: number | null
    neutrofilos_bastoes: number | null; linfocitos: number | null
    monocitos: number | null; eosinofilos: number | null; basofilos: number | null
  }
  plaquetas: { contagem: number | null; vpm: number | null }
  bioquimica: {
    ureia: number | null; creatinina: number | null
    alt_tgp: number | null; ast_tgo: number | null
    fosforo: number | null; potassio: number | null
    sodio: number | null; albumina: number | null; proteina_total: number | null
  }
  interpretacao_ia: {
    resumo: string
    achados_relevantes: string[]
    alertas: string[]
    estadiamento_iris_sugerido: string | null
  }
  laboratorio: string | null
  data_coleta: string | null
  data_resultado: string | null
}

const SUPPORT_HREF = `https://wa.me/5527997987058?text=${encodeURIComponent(
  'Ola! Tive uma falha ao processar um laudo no Lab Evolution e preciso de suporte. Nao enviarei dados do paciente por aqui.',
)}`

const GENERIC_UPLOAD_ERROR = 'Não foi possível enviar o PDF. Verifique sua conexão e tente novamente.'
const GENERIC_AI_ERROR = 'Não foi possível processar o laudo agora. Tente novamente em instantes.'
const UNKNOWN_AI_OUTCOME = 'A resposta da análise não pôde ser confirmada. Recarregue a página e confira o status antes de tentar novamente.'

class LaudoUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LaudoUserError'
  }
}

function safeLaudoServiceMessage(value: unknown) {
  if (typeof value !== 'string') return GENERIC_AI_ERROR
  if (value.startsWith('Limite de análises gratuitas atingido')) {
    return 'O limite mensal de análises foi atingido. Aguarde a renovação ou contate o suporte.'
  }
  if (value.includes('já foi processado')) return 'Este laudo já foi processado anteriormente.'
  if (value.includes('esta em processamento') || value.includes('está em processamento')) {
    return 'Este laudo já está em processamento. Aguarde antes de tentar novamente.'
  }
  if (value.includes('Não autorizado') || value.includes('Acesso negado')) {
    return 'Sua sessão não autoriza esta operação. Entre novamente.'
  }
  return GENERIC_AI_ERROR
}

function ValueRow({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-white/5">
      <span className="text-xs text-slate-500 dark:text-science-200">{label}</span>
      <span className="text-xs font-semibold text-slate-800 dark:text-white">
        {value !== null ? `${value}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden /> : <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />}
      </button>
      {open && <div id={contentId} className="px-4 pb-4">{children}</div>}
    </div>
  )
}

/**
 * Upload de laudo PDF com análise por IA e visualização side-by-side.
 * STORY-403: UI Lab Evolution para laudos.
 */
export function LaudoUploader({ petId }: { petId: string }) {
  const [supabase] = useState(() => createClient())
  const [isPending, startTransition] = useTransition()
  const [dragActive, setDragActive] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saving' | 'analyzing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<HemogramaResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [aiQuota, setAiQuota] = useState<{ used: number; limit: number } | null>(null)
  const [aiQuotaStatus, setAiQuotaStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [laudoId, setLaudoId] = useState<string | null>(null)
  const [cleanupBlocked, setCleanupBlocked] = useState(false)
  const [aiRetryBlocked, setAiRetryBlocked] = useState(false)
  const operationInFlightRef = useRef(false)

  // Busca cota de IA do usuário
  useEffect(() => {
    let active = true

    async function fetchQuota() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          if (active) setAiQuotaStatus('error')
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('ai_quota_used, ai_quota_limit')
          .eq('id', user.id)
          .maybeSingle()

        if (error || !data) {
          if (active) setAiQuotaStatus('error')
          return
        }
        if (active) {
          setAiQuota({
            used: data.ai_quota_used ?? 0,
            limit: data.ai_quota_limit ?? 5
          })
          setAiQuotaStatus('ready')
        }
      } catch {
        if (active) setAiQuotaStatus('error')
      }
    }
    void fetchQuota()
    return () => { active = false }
  }, [supabase])

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      setErrorMsg('Apenas arquivos PDF são aceitos.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Arquivo muito grande. Máximo: 10 MB.')
      return
    }
    setErrorMsg(null)
    setPdfFile(file)
    setPdfUrl(URL.createObjectURL(file))
    setLaudoId(null)
    setCleanupBlocked(false)
    setAiRetryBlocked(false)
    setStatus('idle')
    setResult(null)
  }, [])

  const clearPdf = useCallback(() => {
    setPdfFile(null)
    setPdfUrl(null)
    setLaudoId(null)
    setCleanupBlocked(false)
    setAiRetryBlocked(false)
    setResult(null)
    setStatus('idle')
  }, [])

  // Revoga a URL atual ao trocar o arquivo ou desmontar o componente.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  /** Etapa 1: Upload PDF → Storage + salvar no banco. Não requer IA. */
  async function handleUpload() {
    if (!pdfFile || laudoId || cleanupBlocked || operationInFlightRef.current) return
    operationInFlightRef.current = true
    setErrorMsg(null)

    startTransition(async () => {
      try {
        setStatus('uploading')
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new LaudoUserError('Sessão expirada. Faça login novamente.')

        const safeName = pdfFile.name
          .normalize('NFKD')
          .replace(/[^\w.-]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'laudo.pdf'
        const fileName = `${user.id}/${Date.now()}_${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('laudos')
          .upload(fileName, pdfFile, { contentType: 'application/pdf', upsert: false })
        if (uploadError) throw new LaudoUserError(GENERIC_UPLOAD_ERROR)

        setStatus('saving')
        const { data: laudo, error: insertError } = await supabase
          .from('laudos_pdf')
          .insert({
            pet_id: petId,
            vet_id: user.id,
            storage_path: fileName,
            nome_arquivo: pdfFile.name,
            tipo_exame: 'hemograma',
            tamanho_bytes: pdfFile.size,
          })
          .select('id')
          .single() as { data: { id: string } | null; error: Error | null }

        if (insertError || !laudo) {
          const { data: removedFiles, error: cleanupError } = await supabase.storage
            .from('laudos')
            .remove([fileName])

          // Sem DELETE + SELECT no Storage, `remove` não confirma a limpeza.
          // Bloqueamos novo envio para não multiplicar objetos órfãos.
          if (cleanupError || removedFiles?.length !== 1) {
            setCleanupBlocked(true)
            throw new LaudoUserError(
              'O envio não foi concluído e a limpeza automática não pôde ser confirmada. Não repita o envio; acione o suporte.'
            )
          }
          throw new LaudoUserError('O PDF foi enviado, mas não pôde ser registrado. Tente novamente.')
        }

        setLaudoId(laudo.id)
        setStatus('done')
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[LaudoUploader] upload failed', {
            type: err instanceof Error ? err.name : 'UnknownError',
          })
        }
        setErrorMsg(err instanceof LaudoUserError ? err.message : GENERIC_UPLOAD_ERROR)
        setStatus('error')
      } finally {
        operationInFlightRef.current = false
      }
    })
  }

  /** Etapa 2 (opcional): Aciona a análise por IA para laudo já salvo. */
  async function handleAnalyzeWithAI() {
    if (!laudoId || operationInFlightRef.current) return
    operationInFlightRef.current = true
    setErrorMsg(null)

    startTransition(async () => {
      try {
        setStatus('analyzing')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.access_token) {
          throw new LaudoUserError('Sessão expirada. Faça login novamente.')
        }

        const fnRes = await supabase.functions.invoke('parse-laudo', {
          body: { laudoId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (fnRes.error) {
          const failure = await resolveLaudoFunctionFailure(fnRes.error, fnRes.data)
          if (failure.outcomeUnknown) setAiRetryBlocked(true)
          throw new LaudoUserError(
            failure.outcomeUnknown
              ? UNKNOWN_AI_OUTCOME
              : safeLaudoServiceMessage(failure.serviceError),
          )
        }
        if (!fnRes.data?.success) {
          throw new LaudoUserError(safeLaudoServiceMessage(fnRes.data?.error))
        }
        if (!fnRes.data?.data) throw new LaudoUserError(GENERIC_AI_ERROR)

        setResult(fnRes.data.data as HemogramaResult)
        setAiQuota((quota) => quota ? { ...quota, used: quota.used + 1 } : quota)
        setStatus('done')
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[LaudoUploader] analysis failed', {
            type: err instanceof Error ? err.name : 'UnknownError',
          })
        }
        setErrorMsg(err instanceof LaudoUserError ? err.message : GENERIC_AI_ERROR)
        setStatus('error')
      } finally {
        operationInFlightRef.current = false
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      {!pdfFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer ${
            dragActive ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-white/10 hover:border-brand-300 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Área de upload de laudo PDF"
          onClick={() => document.getElementById('laudo-file-input')?.click()}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            document.getElementById('laudo-file-input')?.click()
          }}
        >
          <Upload className="h-10 w-10 text-slate-300 dark:text-science-700 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 dark:text-science-100 mb-1">Arraste o laudo PDF aqui</p>
          <p className="text-sm text-slate-400 dark:text-science-400 mb-4">ou clique para selecionar o arquivo</p>
          <span className="text-xs text-slate-300 dark:text-science-500">PDF · máx. 10 MB</span>
          <input
            id="laudo-file-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        /* Side-by-side: PDF viewer + resultado */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* PDF Viewer */}
          <div className="order-2 lg:order-1 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#0F2244] border-b border-slate-100 dark:border-white/10">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
              <span className="text-sm font-medium text-slate-700 dark:text-science-100 truncate flex-1">{pdfFile.name}</span>
              <button
                type="button"
                onClick={clearPdf}
                disabled={isPending || cleanupBlocked}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trocar
              </button>
            </div>
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                title="Visualizador de laudo PDF"
                className="h-[50dvh] min-h-72 w-full lg:h-[600px]"
              />
            )}
          </div>

          {/* Painel de resultado */}
          <div className="order-1 lg:order-2 space-y-4">
            {/* Botão principal: carregamento do PDF */}
                {(status === 'idle' || (status === 'error' && !laudoId && !cleanupBlocked)) && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold text-sm hover:from-brand-600 hover:to-brand-700 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  {status === 'error' ? 'Tentar novamente' : 'Salvar laudo no sistema'}
                </button>
                <p className="text-center text-xs text-slate-400 dark:text-science-400">
                  O arquivo será salvo com segurança no seu histórico clínico.
                </p>
              </div>
            )}

            {/* Progresso: upload */}
            {status === 'uploading' && (
              <div role="status" aria-live="polite" className="flex items-center gap-3 px-6 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" aria-hidden />
                <span className="text-sm font-medium text-slate-700 dark:text-science-100">Enviando PDF…</span>
              </div>
            )}

            {/* Progresso: gravando no banco */}
            {status === 'saving' && (
              <div role="status" aria-live="polite" className="flex items-center gap-3 px-6 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" aria-hidden />
                <span className="text-sm font-medium text-slate-700 dark:text-science-100">Registrando laudo…</span>
              </div>
            )}

            {/* Progresso: IA */}
            {status === 'analyzing' && (
              <div role="status" aria-live="polite" className="flex items-center gap-3 px-6 py-4 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-400/20">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-brand-700 dark:text-science-100">IA analisando o laudo…</p>
                  <p className="text-xs text-brand-400 dark:text-science-300 mt-0.5">Extraindo dados clínicos do laudo…</p>
                </div>
              </div>
            )}

            {/* Sucesso: PDF salvo, sem análise de IA ainda */}
            {laudoId && !result && (status === 'done' || status === 'error') && (
              <div className="space-y-3">
                <div role="status" aria-live="polite" className="flex items-start gap-3 px-5 py-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">PDF salvo com sucesso!</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      O laudo está seguro no histórico do paciente.
                    </p>
                  </div>
                </div>
                {/* Botão opcional de análise por IA */}
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isPending || aiRetryBlocked || aiQuotaStatus !== 'ready' || (aiQuota !== null && aiQuota.used >= aiQuota.limit)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-200 dark:border-brand-400/20 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-science-100 font-semibold text-sm hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  {aiQuotaStatus === 'loading'
                    ? 'Verificando limite de análises...'
                    : aiQuotaStatus === 'error'
                      ? 'Análise temporariamente indisponível'
                      : aiRetryBlocked
                        ? 'Recarregue para confirmar o status'
                      : aiQuota !== null && aiQuota.used >= aiQuota.limit
                        ? 'Limite de análises atingido'
                        : status === 'error'
                          ? 'Tentar análise novamente'
                          : 'Analisar com IA (opcional)'}
                </button>
                {aiQuotaStatus === 'error' && (
                  <p role="alert" className="text-center text-xs text-amber-700 dark:text-amber-300">
                    Não foi possível confirmar sua cota. Recarregue a página antes de solicitar a análise.
                  </p>
                )}
                {aiQuota && (
                  <p className="text-center text-xs text-slate-400 dark:text-science-400">
                    {aiQuota.used} de {aiQuota.limit} análises gratuitas usadas este mês.
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{errorMsg}</p>
                    <p className="text-xs text-red-600 dark:text-red-300">
                      {cleanupBlocked
                        ? 'Não repita o envio nesta tela. O suporte deverá verificar o armazenamento e o registro antes de uma nova tentativa.'
                        : laudoId && aiRetryBlocked
                          ? 'O PDF já está salvo. Recarregue a página e confirme o status da análise antes de qualquer nova tentativa. Evite enviar dados sensíveis pelo WhatsApp.'
                        : laudoId
                          ? 'O PDF já está salvo. Não o envie novamente; tente apenas a análise opcional ou acione o suporte. Evite enviar dados sensíveis pelo WhatsApp.'
                          : 'Se a falha persistir, tente reenviar o PDF ou acione o suporte para análise manual. Evite enviar dados sensíveis pelo WhatsApp.'}
                    </p>
                    <a
                      href={SUPPORT_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-100 dark:hover:bg-red-500/10"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      Falar com suporte
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Resultado da IA */}
            {result && status === 'done' && (
              <div className="space-y-3" aria-live="polite">
                {/* Interpretação */}
                <div className="bg-gradient-to-br from-brand-50 to-blue-50 dark:from-brand-500/10 dark:to-blue-500/10 rounded-xl border border-brand-100 dark:border-brand-400/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-500" aria-hidden />
                    <span className="font-semibold text-brand-800 dark:text-science-100 text-sm">Análise concluída</span>
                    {result.interpretacao_ia.estadiamento_iris_sugerido && (
                      <span className="ml-auto px-2.5 py-0.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                        {result.interpretacao_ia.estadiamento_iris_sugerido}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-science-100 leading-relaxed mb-3">{result.interpretacao_ia.resumo}</p>

                  {result.interpretacao_ia.alertas.length > 0 && (
                    <div className="space-y-1.5">
                      {result.interpretacao_ia.alertas.map((alerta) => (
                        <div key={alerta} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                          {alerta}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Séries hematológicas */}
                <Section title="🔴 Série Vermelha">
                  <ValueRow label="Hemácias" value={result.serie_vermelha.hemacias} unit="×10⁶/µL" />
                  <ValueRow label="Hemoglobina" value={result.serie_vermelha.hemoglobina} unit="g/dL" />
                  <ValueRow label="Hematócrito" value={result.serie_vermelha.hematocrito} unit="%" />
                  <ValueRow label="VCM" value={result.serie_vermelha.vcm} unit="fL" />
                  <ValueRow label="HCM" value={result.serie_vermelha.hcm} unit="pg" />
                  <ValueRow label="CHCM" value={result.serie_vermelha.chcm} unit="g/dL" />
                </Section>

                <Section title="⚪ Série Branca" defaultOpen={false}>
                  <ValueRow label="Leucócitos totais" value={result.serie_branca.leucocitos_totais} unit="/µL" />
                  <ValueRow label="Neutrófilos segm." value={result.serie_branca.neutrofilos_segmentados} unit="/µL" />
                  <ValueRow label="Linfócitos" value={result.serie_branca.linfocitos} unit="/µL" />
                  <ValueRow label="Monócitos" value={result.serie_branca.monocitos} unit="/µL" />
                  <ValueRow label="Eosinófilos" value={result.serie_branca.eosinofilos} unit="/µL" />
                </Section>

                <Section title="🧪 Bioquímica Renal" defaultOpen={true}>
                  <ValueRow label="Ureia" value={result.bioquimica.ureia} unit="mg/dL" />
                  <ValueRow label="Creatinina" value={result.bioquimica.creatinina} unit="mg/dL" />
                  <ValueRow label="Fósforo" value={result.bioquimica.fosforo} unit="mg/dL" />
                  <ValueRow label="Potássio" value={result.bioquimica.potassio} unit="mEq/L" />
                  <ValueRow label="Sódio" value={result.bioquimica.sodio} unit="mEq/L" />
                  <ValueRow label="Albumina" value={result.bioquimica.albumina} unit="g/dL" />
                </Section>

                <Section title="💊 Plaquetas" defaultOpen={false}>
                  <ValueRow label="Contagem" value={result.plaquetas.contagem} unit="×10³/µL" />
                  <ValueRow label="VPM" value={result.plaquetas.vpm} unit="fL" />
                </Section>

                {/* Achados relevantes */}
                {result.interpretacao_ia.achados_relevantes.length > 0 && (
                  <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical className="h-4 w-4 text-brand-500" />
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">Achados relevantes</span>
                    </div>
                    <ul className="space-y-1.5">
                      {result.interpretacao_ia.achados_relevantes.map((achado) => (
                        <li key={achado} className="flex items-start gap-2 text-xs text-slate-600 dark:text-science-200">
                          <span className="text-brand-400 mt-0.5">•</span>
                          {achado}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
