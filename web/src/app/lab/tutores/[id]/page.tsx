import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TutorPetActions } from './TutorPetActions'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  PawPrint,
  User,
  Plus,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Detalhe do Tutor — Lab Evolution',
  robots: { index: false, follow: false },
}

const ESPECIE_EMOJI: Record<string, string> = {
  canino: '🐶', felino: '🐱', equino: '🐴',
  bovino: '🐮', suino: '🐷', ave: '🐦',
  roedor: '🐭', reptil: '🦎', outro: '🐾',
}

export default async function TutorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  type TutorRow = {
    id: string; nome: string; email: string | null; telefone: string
    cidade: string | null; estado: string | null; endereco: string | null
    cep: string | null; criado_em: string
  }

  const { data: tutor } = await supabase
    .from('tutores')
    .select('id, nome, email, telefone, cidade, estado, endereco, cep, criado_em')
    .eq('id', id)
    .single() as { data: TutorRow | null; error: unknown }

  if (!tutor) notFound()

  type PetRow = {
    id: string; nome: string; especie: string; raca: string | null
    idade_anos: number | null; status_paciente: string; peso_atual: number | null
  }

  const { data: pets } = await supabase
    .from('pets')
    .select('id, nome, especie, raca, idade_anos, status_paciente, peso_atual')
    .eq('tutor_id', id)
    .order('criado_em', { ascending: false }) as { data: PetRow[] | null }

  const petsVivos = pets?.filter((p) => p.status_paciente !== 'inativo') ?? []

  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Link
        href="/lab/tutores"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para tutores
      </Link>

      {/* Header do tutor */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-xl font-bold shrink-0">
            {tutor.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-slate-900">{tutor.nome}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cadastrado em {new Date(tutor.criado_em).toLocaleDateString('pt-BR')}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tutor.telefone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  {tutor.telefone}
                </div>
              )}
              {tutor.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  {tutor.email}
                </div>
              )}
              {(tutor.cidade || tutor.estado) && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  {[tutor.cidade, tutor.estado].filter(Boolean).join(', ')}
                </div>
              )}
              {tutor.endereco && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  {tutor.endereco}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-brand-500" strokeWidth={2} />
            Pets ({petsVivos.length})
          </h2>
          <Link
            href={`/lab/pacientes/novo?tutor_id=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo pet
          </Link>
        </div>

        {petsVivos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
            <PawPrint className="h-10 w-10 mx-auto mb-3 opacity-20" strokeWidth={1.5} />
            <p className="font-medium text-slate-500">Nenhum pet cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {petsVivos.map((pet) => (
              <article
                key={pet.id}
                className={`bg-white rounded-2xl border p-5 transition-all ${
                  pet.status_paciente === 'obito'
                    ? 'border-slate-200 opacity-60'
                    : 'border-slate-100 hover:border-brand-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl" role="img" aria-label={pet.especie}>
                    {ESPECIE_EMOJI[pet.especie] ?? '🐾'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-slate-900">{pet.nome}</p>
                    <p className="text-xs text-slate-400 capitalize">
                      {pet.especie}{pet.raca ? ` · ${pet.raca}` : ''}{pet.idade_anos ? ` · ${pet.idade_anos} anos` : ''}
                    </p>
                    {pet.peso_atual && (
                      <p className="text-xs text-slate-500 mt-0.5">{pet.peso_atual} kg</p>
                    )}
                  </div>
                </div>

                <TutorPetActions pet={pet} tutorNome={tutor.nome} />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
