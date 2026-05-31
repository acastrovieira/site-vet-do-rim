import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TutorPetActions } from '@/app/lab/tutores/[id]/TutorPetActions'
import {
  ArrowLeft,
  PawPrint,
  User,
  Scale,
  FlaskConical,
  Plus,
  FileText,
} from 'lucide-react'

interface Props {
  params: Promise<{ petId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { petId } = await params
  const supabase = await createClient()

  type PetMeta = { nome: string }
  const { data: pet } = await supabase
    .from('pets')
    .select('nome')
    .eq('id', petId)
    .single() as { data: PetMeta | null; error: unknown }

  return {
    title: pet ? `${pet.nome} — Lab Evolution` : 'Paciente — Lab Evolution',
    robots: { index: false, follow: false },
  }
}

const ESPECIE_EMOJI: Record<string, string> = {
  canino: '🐶', felino: '🐱', equino: '🐴',
  bovino: '🐮', suino: '🐷', ave: '🐦',
  roedor: '🐭', reptil: '🦎', outro: '🐾',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
  em_tratamento: { label: 'Em tratamento', color: 'bg-blue-100 text-blue-700' },
  alta: { label: 'Alta', color: 'bg-emerald-100 text-emerald-700' },
  obito: { label: 'Óbito', color: 'bg-slate-200 text-slate-500' },
  inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-400' },
}

export default async function PacienteDetailPage({ params }: Props) {
  const { petId } = await params
  const supabase = await createClient()

  type PetRow = {
    id: string
    nome: string
    especie: string
    raca: string | null
    idade_anos: number | null
    idade_meses: number | null
    peso_atual: number | null
    status_paciente: string
    criado_em: string
    tutor_id: string
  }

  const { data: pet } = await supabase
    .from('pets')
    .select('id, nome, especie, raca, idade_anos, idade_meses, peso_atual, status_paciente, criado_em, tutor_id')
    .eq('id', petId)
    .single() as { data: PetRow | null; error: unknown }

  if (!pet) notFound()

  type TutorRow = { id: string; nome: string; telefone: string; email: string | null }

  const { data: tutor } = await supabase
    .from('tutores')
    .select('id, nome, telefone, email')
    .eq('id', pet.tutor_id)
    .single() as { data: TutorRow | null; error: unknown }

  type LaudoRow = { id: string; nome_arquivo: string; tipo_exame: string; status: string; created_at: string }

  const { data: laudos } = await supabase
    .from('laudos_pdf')
    .select('id, nome_arquivo, tipo_exame, status, created_at')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(10) as { data: LaudoRow[] | null; error: unknown }

  const statusInfo = STATUS_LABELS[pet.status_paciente] ?? { label: pet.status_paciente, color: 'bg-slate-100 text-slate-500' }

  const idadeStr = [
    pet.idade_anos ? `${pet.idade_anos} ano${pet.idade_anos !== 1 ? 's' : ''}` : null,
    pet.idade_meses ? `${pet.idade_meses} mês${pet.idade_meses !== 1 ? 'es' : ''}` : null,
  ].filter(Boolean).join(' e ') || null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href="/lab/pacientes"
          className="inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Pacientes
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-medium truncate">{pet.nome}</span>
      </div>

      {/* Header do paciente */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">
            {ESPECIE_EMOJI[pet.especie] ?? '🐾'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-slate-900">{pet.nome}</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5 capitalize">
              {pet.especie}{pet.raca ? ` · ${pet.raca}` : ''}
              {idadeStr ? ` · ${idadeStr}` : ''}
              {pet.peso_atual ? ` · ${pet.peso_atual} kg` : ''}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Cadastrado em {new Date(pet.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Ações de status */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <TutorPetActions pet={pet} tutorNome={tutor?.nome ?? 'tutor'} />
        </div>
      </div>

      {/* Tutor responsável */}
      {tutor && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
                {tutor.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {tutor.nome}
                </p>
                <p className="text-xs text-slate-500">{tutor.telefone}{tutor.email ? ` · ${tutor.email}` : ''}</p>
              </div>
            </div>
            <Link
              href={`/lab/tutores/${tutor.id}`}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Ver tutor →
            </Link>
          </div>
        </div>
      )}

      {/* Laudos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-brand-500" strokeWidth={2} />
            Laudos e Exames
          </h2>
          <Link
            href={`/lab/pacientes/${petId}/laudos`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Analisar laudo
          </Link>
        </div>

        {!laudos || laudos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <FlaskConical className="h-10 w-10 mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
            <p className="font-medium text-slate-500">Nenhum laudo analisado ainda</p>
            <p className="text-sm text-slate-400 mt-1">
              Faça o upload de um hemograma ou bioquímica para análise por IA.
            </p>
            <Link
              href={`/lab/pacientes/${petId}/laudos`}
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Analisar primeiro laudo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {laudos.map((laudo) => (
              <div
                key={laudo.id}
                className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3"
              >
                <FileText className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{laudo.nome_arquivo}</p>
                  <p className="text-xs text-slate-400">
                    {laudo.tipo_exame} · {new Date(laudo.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  laudo.status === 'concluido'
                    ? 'bg-green-100 text-green-700'
                    : laudo.status === 'erro'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {laudo.status === 'concluido' ? 'Analisado' : laudo.status === 'erro' ? 'Erro' : 'Processando'}
                </span>
              </div>
            ))}
            <Link
              href={`/lab/pacientes/${petId}/laudos`}
              className="block text-center text-sm font-semibold text-brand-600 hover:text-brand-700 py-2 transition-colors"
            >
              Ver todos os laudos →
            </Link>
          </div>
        )}
      </div>

      {/* Dados físicos */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Scale className="h-4 w-4 text-brand-500" />
          Dados clínicos
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Espécie</dt>
            <dd className="text-sm font-semibold text-slate-800 capitalize">{pet.especie}</dd>
          </div>
          {pet.raca && (
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Raça</dt>
              <dd className="text-sm font-semibold text-slate-800">{pet.raca}</dd>
            </div>
          )}
          {idadeStr && (
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Idade</dt>
              <dd className="text-sm font-semibold text-slate-800">{idadeStr}</dd>
            </div>
          )}
          {pet.peso_atual && (
            <div>
              <dt className="text-xs text-slate-400 mb-0.5">Peso</dt>
              <dd className="text-sm font-semibold text-slate-800">{pet.peso_atual} kg</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-400 mb-0.5">Status</dt>
            <dd>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
