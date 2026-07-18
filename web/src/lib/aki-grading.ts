export type UrineOutputStatus =
  | 'normal'
  | 'oliguria'
  | 'anuria'
  | 'nao_avaliado'

export type AKIGrade = 1 | 2 | 3 | 4 | 5
export type AKIUrineSubgrade = 'O' | 'NO' | null

export interface AKIGradingInput {
  creatinineMgDl: number
  previousCreatinineMgDl?: number | null
  intervalHours?: number | null
  urineOutputStatus: UrineOutputStatus
  hasClinicalEvidence: boolean
}

export interface AKIGradingResult {
  grade: AKIGrade
  urineSubgrade: AKIUrineSubgrade
  deltaMgDl?: number
}

/**
 * Classifica a faixa IRIS AKI 2026 sem usar o débito urinário para elevar
 * o grau. O débito urinário é um subgrau independente (O/NO).
 */
export function gradeAKI(input: AKIGradingInput): AKIGradingResult | null {
  const {
    creatinineMgDl,
    previousCreatinineMgDl,
    intervalHours,
    urineOutputStatus,
    hasClinicalEvidence,
  } = input

  if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0) return null

  const hasQualifyingDelta =
    previousCreatinineMgDl !== null &&
    previousCreatinineMgDl !== undefined &&
    intervalHours !== null &&
    intervalHours !== undefined &&
    intervalHours > 0 &&
    intervalHours <= 48 &&
    creatinineMgDl - previousCreatinineMgDl > 0.3000001

  const hasOliguriaEvidence =
    urineOutputStatus === 'oliguria' || urineOutputStatus === 'anuria'

  // Um valor isolado de creatinina não diferencia IRA de DRC.
  if (!hasClinicalEvidence && !hasQualifyingDelta && !hasOliguriaEvidence) {
    return null
  }

  let grade: AKIGrade
  if (creatinineMgDl < 1.6) grade = 1
  else if (creatinineMgDl >= 1.7 && creatinineMgDl <= 2.5) grade = 2
  else if (creatinineMgDl >= 2.6 && creatinineMgDl <= 5) grade = 3
  else if (creatinineMgDl >= 5.1 && creatinineMgDl <= 10) grade = 4
  else if (creatinineMgDl > 10) grade = 5
  else return null

  const urineSubgrade: AKIUrineSubgrade =
    urineOutputStatus === 'nao_avaliado'
      ? null
      : hasOliguriaEvidence
        ? 'O'
        : 'NO'

  return {
    grade,
    urineSubgrade,
    deltaMgDl: hasQualifyingDelta
      ? creatinineMgDl - (previousCreatinineMgDl as number)
      : undefined,
  }
}
