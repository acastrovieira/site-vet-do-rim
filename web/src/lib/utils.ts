import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utilitário para compor classes do Tailwind de forma segura,
 * resolvendo conflitos com tailwind-merge e condicionais com clsx.
 *
 * @param inputs - Classes CSS ou expressões condicionais
 * @returns String de classes CSS mescladas
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
