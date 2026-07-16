'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  laboratorio: string
  data_coleta: string
  data_resultado: string
}

const SUPPORT_HREF = `https://wa.me/5527997987058?text=${encodeURIComponent(
  'Ola! Tive uma falha ao processar um laudo no Lab Evolution e preciso de suporte. Nao enviarei dados do paciente por aqui.',
)}`

function ValueRow({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">
        {value !== null ? `${value}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

/**
 * Upload de laudo PDF com análise por IA e visualização side-by-side.
 * STORY-403: UI Lab Evolution para laudos.
 */
export function LaudoUploader({ petId }: { petId: string }) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()
  const [dragActive, setDragActive] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saving' | 'analyzing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<HemogramaResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [aiQuota, setAiQuota] = useState<{ used: number; limit: number } | null>(null)
  const [laudoId, setLaudoId] = useState<string | null>(null)

  // Busca cota de IA do usuário
  useEffect(() => {
    async function fetchQuota() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data } = await supabase
        .from('profiles')
        .select('ai_quota_used, ai_quota_limit')
        .eq('id', user.id)
        .single()
        
        
      if (data) {
        setAiQuota({
          used: data.ai_quota_used || 0,
          limit: data.ai_quota_limit || 5
        })
      }
    }
    fetchQuota()
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
    // Revoga URL anterior antes de criar uma nova (previne memory leak)
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setStatus('idle')
    setResult(null)
  }, [])

  const clearPdf = useCallback(() => {
    setPdfFile(null)
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setResult(null)
    setStatus('idle')
  }, [])

  // Cleanup: revoga blob URL ao desmontar o componente
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  /** Etapa 1: Upload PDF → Storage + salvar no banco. Não requer IA. */
  async function handleUpload() {
    if (!pdfFile) return
    setErrorMsg(null)

    startTransition(async () => {
      try {
        setStatus('uploading')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Sessão expirada. Faça login novamente.')

        const safeName = pdfFile.name
          .normalize('NFKD')
          .replace(/[^\w.-]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'laudo.pdf'
        const fileName = `${user.id}/${Date.now()}_${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('laudos')
          .upload(fileName, pdfFile, { contentType: 'application/pdf', upsert: false })
        if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`)

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
          await supabase.storage.from('laudos').remove([fileName])
          throw new Error('Erro ao registrar laudo no banco.')
        }

        setLaudoId(laudo.id)
        setStatus('done')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido')
        setStatus('error')
      }
    })
  }

  /** Etapa 2 (opcional): Aciona a análise por IA para laudo já salvo. */
  async function handleAnalyzeWithAI() {
    if (!laudoId) return
    setErrorMsg(null)

    startTransition(async () => {
      try {
        setStatus('analyzing')
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.')

        const fnRes = await supabase.functions.invoke('parse-laudo', {
          body: { laudoId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (fnRes.error) {
          const serverMsg = fnRes.data?.error
          throw new Error(serverMsg || fnRes.error.message || 'Falha na comunicação com o serviço de IA.')
        }
        if (!fnRes.data?.success) {
          throw new Error(fnRes.data?.error || 'Erro desconhecido ao processar o laudo.')
        }
        if (!fnRes.data?.data) throw new Error('A IA não retornou dados. Tente reenviar o PDF.')

        setResult(fnRes.data.data as HemogramaResult)
        if (aiQuota) setAiQuota({ ...aiQuota, used: aiQuota.used + 1 })
        setStatus('done')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido')
        setStatus('error')
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
            dragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Área de upload de laudo PDF"
          onClick={() => document.getElementById('laudo-file-input')?.click()}
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('laudo-file-input')?.click()}
        >
          <Upload className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 mb-1">Arraste o laudo PDF aqui</p>
          <p className="text-sm text-slate-400 mb-4">ou clique para selecionar o arquivo</p>
          <span className="text-xs text-slate-300">PDF · máx. 10 MB</span>
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
          <div className="order-2 lg:order-1 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50">
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
              <span className="text-sm font-medium text-slate-700 truncate flex-1">{pdfFile.name}</span>
              <button
                type="button"
                onClick={clearPdf}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
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
            {(status === 'idle' || status === 'error') && (
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
                <p className="text-center text-xs text-slate-400">
                  O arquivo será salvo com segurança no seu histórico clínico.
                </p>
              </div>
            )}

            {/* Progresso: upload */}
            {status === 'uploading' && (
              <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-slate-50 border border-slate-100">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                <span className="text-sm font-medium text-slate-700">Enviando PDF…</span>
              </div>
            )}

            {/* Progresso: gravando no banco */}
            {status === 'saving' && (
              <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-slate-50 border border-slate-100">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                <span className="text-sm font-medium text-slate-700">Registrando laudo…</span>
              </div>
            )}

            {/* Progresso: IA */}
            {status === 'analyzing' && (
              <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-brand-50 border border-brand-100">
                <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-brand-700">IA analisando o laudo…</p>
                  <p className="text-xs text-brand-400 mt-0.5">Extraindo dados clínicos do laudo…</p>
                </div>
              </div>
            )}

            {/* Sucesso: PDF salvo, sem análise de IA ainda */}
            {status === 'done' && !result && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-green-50 border border-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-green-800">PDF salvo com sucesso!</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      O laudo está seguro no histórico do paciente.
                    </p>
                  </div>
                </div>
                {/* Botão opcional de análise por IA */}
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isPending || (aiQuota !== null && aiQuota.used >= aiQuota.limit)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 font-semibold text-sm hover:bg-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="h-4 w-4" aria-hidden />
                  {aiQuota !== null && aiQuota.used >= aiQuota.limit
                    ? 'Limite de análises atingido'
                    : 'Analisar com IA (opcional)'}
                </button>
                {aiQuota && (
                  <p className="text-center text-xs text-slate-400">
                    {aiQuota.used} de {aiQuota.limit} análises gratuitas usadas este mês.
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>{errorMsg}</p>
                    <p className="text-xs text-red-600">
                      Se a falha persistir, tente reenviar o PDF ou acione o suporte para analise manual. Evite enviar dados sensiveis pelo WhatsApp.
                    </p>
                    <a
                      href={SUPPORT_HREF}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
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
                <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl border border-brand-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-500" aria-hidden />
                    <span className="font-semibold text-brand-800 text-sm">Análise concluída</span>
                    {result.interpretacao_ia.estadiamento_iris_sugerido && (
                      <span className="ml-auto px-2.5 py-0.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                        {result.interpretacao_ia.estadiamento_iris_sugerido}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">{result.interpretacao_ia.resumo}</p>

                  {result.interpretacao_ia.alertas.length > 0 && (
                    <div className="space-y-1.5">
                      {result.interpretacao_ia.alertas.map((alerta) => (
                        <div key={alerta} className="flex items-start gap-2 text-xs text-amber-800">
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
                  <div className="bg-white rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical className="h-4 w-4 text-brand-500" />
                      <span className="text-sm font-semibold text-slate-800">Achados relevantes</span>
                    </div>
                    <ul className="space-y-1.5">
                      {result.interpretacao_ia.achados_relevantes.map((achado) => (
                        <li key={achado} className="flex items-start gap-2 text-xs text-slate-600">
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
