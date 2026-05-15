import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LaudoUploader } from '@/components/lab/LaudoUploader'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ petId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { petId } = await params
  return {
    title: `Laudos do Paciente — Lab Evolution`,
    description: `Análise de laudos por IA para o paciente ${petId}`,
    robots: { index: false, follow: false },
  }
}

export default async function LaudosPacientePage({ params }: Props) {
  const { petId } = await params
  const supabase = await createClient()

  type PetRow = { id: string; nome: string; especie: string; raca: string | null }

  // Busca dados do pet para exibir nome
  const { data: pet } = await supabase
    .from('pets')
    .select('id, nome, especie, raca')
    .eq('id', petId)
    .single() as { data: PetRow | null; error: Error | null }

  if (!pet) notFound()

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/lab/pacientes"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Pacientes
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-700 font-medium">{pet.nome}</span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Laudos</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Laudos — {pet.nome}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {pet.especie} · {pet.raca} · Análise de hemograma e bioquímica por IA
        </p>
      </div>

      {/* Uploader com visualização side-by-side */}
      <LaudoUploader petId={petId} />
    </div>
  )
}
