export interface TutorOption {
  id: string
  nome: string
}

export const TUTOR_SELECTION_LIMIT = 200

export function resolveTutorSelection(
  tutorRows: readonly TutorOption[],
  requestedTutorId?: string,
  requestedTutor?: TutorOption | null,
) {
  const tutorLimitExceeded = tutorRows.length > TUTOR_SELECTION_LIMIT
  let selectableTutors = tutorRows.slice(0, TUTOR_SELECTION_LIMIT)
  const requestedTutorFromRows = requestedTutorId
    ? tutorRows.find((tutor) => tutor.id === requestedTutorId)
    : undefined
  const verifiedRequestedTutor = requestedTutor?.id === requestedTutorId
    ? requestedTutor
    : requestedTutorFromRows

  if (
    requestedTutorId &&
    verifiedRequestedTutor &&
    !selectableTutors.some((tutor) => tutor.id === requestedTutorId)
  ) {
    selectableTutors = [verifiedRequestedTutor, ...selectableTutors]
  }

  const safeDefaultTutorId = requestedTutorId && selectableTutors.some(
    (tutor) => tutor.id === requestedTutorId,
  )
    ? requestedTutorId
    : undefined
  const selectionRequiresTutorFlow = tutorLimitExceeded && !safeDefaultTutorId
  const tutores = tutorLimitExceeded && safeDefaultTutorId
    ? selectableTutors.filter((tutor) => tutor.id === safeDefaultTutorId)
    : selectableTutors

  return {
    tutorLimitExceeded,
    safeDefaultTutorId,
    selectionRequiresTutorFlow,
    tutores,
  }
}
