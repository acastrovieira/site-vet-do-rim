'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

interface MotionEnvironment {
  documentVisible: boolean
  windowFocused: boolean
  reducedMotion: boolean
}

const SERVER_ENVIRONMENT: MotionEnvironment = {
  documentVisible: false,
  windowFocused: false,
  reducedMotion: false,
}

let environmentSnapshot = SERVER_ENVIRONMENT
let stopEnvironmentListeners: (() => void) | null = null
const environmentListeners = new Set<() => void>()

function readEnvironment(media: MediaQueryList): MotionEnvironment {
  return {
    documentVisible: document.visibilityState === 'visible',
    windowFocused: document.hasFocus(),
    reducedMotion: media.matches,
  }
}

function subscribeToEnvironment(listener: () => void) {
  environmentListeners.add(listener)

  if (!stopEnvironmentListeners) {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      const next = readEnvironment(media)
      if (
        next.documentVisible === environmentSnapshot.documentVisible
        && next.windowFocused === environmentSnapshot.windowFocused
        && next.reducedMotion === environmentSnapshot.reducedMotion
      ) {
        return
      }
      environmentSnapshot = next
      environmentListeners.forEach((notify) => notify())
    }

    environmentSnapshot = readEnvironment(media)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    media.addEventListener('change', update)
    stopEnvironmentListeners = () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      media.removeEventListener('change', update)
    }
  }

  return () => {
    environmentListeners.delete(listener)
    if (environmentListeners.size === 0 && stopEnvironmentListeners) {
      stopEnvironmentListeners()
      stopEnvironmentListeners = null
      environmentSnapshot = SERVER_ENVIRONMENT
    }
  }
}

function getEnvironmentSnapshot() {
  return environmentSnapshot
}

/**
 * Centraliza a politica de animacao: nenhum ciclo JavaScript roda fora da
 * viewport, em aba oculta, sem foco ou quando o usuario reduz movimento.
 */
export function useMotionActivity<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inViewport, setInViewport] = useState(false)
  const { documentVisible, windowFocused, reducedMotion } = useSyncExternalStore(
    subscribeToEnvironment,
    getEnvironmentSnapshot,
    () => SERVER_ENVIRONMENT,
  )

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (!('IntersectionObserver' in window)) {
      // Politica fail-closed: navegadores sem observer recebem conteudo estatico.
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { threshold: 0.1 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    inViewport,
    reducedMotion,
    canAnimate: inViewport && documentVisible && windowFocused && !reducedMotion,
  }
}
