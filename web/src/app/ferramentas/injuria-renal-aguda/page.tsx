import type { Metadata } from 'next'
import { Header } from '@/components/marketing/Header'
import { Footer } from '@/components/marketing/Footer'
import { IRACalculator } from '@/components/ferramentas/IRACalculator'
import { VetOnlyGate } from '@/components/ferramentas/VetOnlyGate'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Classificação de Injúria Renal Aguda (IRA) — Cães e Gatos',
  description:
    'Compare a creatinina com as faixas IRIS AKI 2026 e registre o subgrau urinário O/NO. A ferramenta exige evidência de IRA e não substitui avaliação veterinária.',
  keywords: [
    'injúria renal aguda veterinária',
    'IRA cão gato classificação',
    'IRIS AKI grading',
    'KDIGO veterinário',
    'oligúria veterinária',
    'uremia aguda cão',
  ],
  alternates: { canonical: '/ferramentas/injuria-renal-aguda' },
}

export default function InjuriaRenalAgudaPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen bg-science-50 pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-xs font-semibold text-red-600 mb-5">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Ferramenta Clínica Veterinária
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Classificação de{' '}
              <span className="text-gradient-brand">Injúria Renal Aguda</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Graus <strong className="text-slate-800">I–V</strong> conforme{' '}
              <strong className="text-slate-800">IRIS AKI 2026</strong>.
              A creatinina define o grau; o débito urinário é registrado separadamente como subgrau O/NO.
            </p>
          </div>

          {/* KDIGO comparison panel */}
          <div className="mb-8 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <h2 className="font-display font-semibold text-slate-800 text-sm mb-4">Critérios de classificação utilizados</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700" role="table">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wider">Grau IRIS AKI</th>
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wider">Creatinina (mg/dL)</th>
                    <th className="text-left py-2 font-semibold text-slate-500 uppercase tracking-wider">Subgrau urinário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { g: 'I', creat: '< 1,6 (+ evidência IRA)', uo: 'O ou NO' },
                    { g: 'II', creat: '1,7 – 2,5', uo: 'O ou NO' },
                    { g: 'III', creat: '2,6 – 5,0', uo: 'O ou NO' },
                    { g: 'IV', creat: '5,1 – 10,0', uo: 'O ou NO' },
                    { g: 'V', creat: '> 10,0', uo: 'O ou NO' },
                  ].map(row => (
                    <tr key={row.g} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 pr-4 font-bold text-brand-600">Grau {row.g}</td>
                      <td className="py-2 pr-4">{row.creat}</td>
                      <td className="py-2">{row.uo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Subgrau O: débito &lt; 1 mL/kg/h ou ausência de produção de urina por 6 horas.
              O subgrau não eleva automaticamente o grau.
            </p>
          </div>

          <VetOnlyGate>
            <IRACalculator />
          </VetOnlyGate>
        </div>
      </main>
      <Footer />
    </>
  )
}
