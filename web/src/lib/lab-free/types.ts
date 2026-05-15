/**
 * Tipos para a versão gratuita da Planilha Laboratorial.
 * Simplificação do vetdorim-lab: sem auth, sem Supabase, sem Capacitor.
 * Dados persistem em localStorage apenas.
 */

export interface FreePatient {
  id: string
  petName: string
  species: string
  breed: string
  sex: 'Macho' | 'Fêmea'
  birthDate: string
  tutorName: string
  createdAt: string
}

export interface LabParameter {
  name: string
  value: string
  unit: string
  refMin?: string
  refMax?: string
}

export interface FreeLabExam {
  id: string
  patientId: string
  examDate: string
  labName: string
  parameters: LabParameter[]
  createdAt: string
}

export const KNOWN_PARAMETERS = [
  'Eritrócitos', 'Hemoglobina', 'Hematócrito', 'VCM', 'HCM', 'CHCM', 'RDW',
  'Leucócitos', 'Neutrófilos', 'Linfócitos', 'Monócitos', 'Eosinófilos', 'Basófilos',
  'Plaquetas', 'VPM',
  'Ureia', 'Creatinina', 'TGO', 'TGP', 'FA', 'GGT', 'Bilirrubina Total',
  'Bilirrubina Direta', 'Bilirrubina Indireta', 'Proteínas Totais', 'Albumina',
  'Globulinas', 'Glicose', 'Colesterol Total', 'Triglicerídeos', 'Sódio', 'Potássio',
  'Cloro', 'Cálcio', 'Fósforo', 'Magnésio', 'Ferro', 'Ferritina',
  'Proteína C Reativa', 'Fibrinogênio', 'TP', 'TTPA',
  'Densidade Urinária', 'pH Urinário', 'Proteína Urinária', 'Glicose Urinária',
  'Creatinina Urinária', 'RPCU', 'GFR',
] as const
