'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, MapPin, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

interface ProfileFormProps {
  initialData: {
    fullName: string | null
    email: string
    phone: string | null
    address: string | null
  }
}

type SectionStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Formulário de edição do perfil do usuário autenticado.
 * Organizado em 3 seções independentes: dados pessoais, contato/endereço, senha.
 */
export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter()
  // Dados pessoais
  const [fullName, setFullName] = useState(initialData.fullName ?? '')
  const [personalStatus, setPersonalStatus] = useState<SectionStatus>('idle')
  const [personalMsg, setPersonalMsg] = useState('')

  // Contato
  const [email, setEmail] = useState(initialData.email)
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [address, setAddress] = useState(initialData.address ?? '')
  const [contactStatus, setContactStatus] = useState<SectionStatus>('idle')
  const [contactMsg, setContactMsg] = useState('')
  const [lastRequestedEmail, setLastRequestedEmail] = useState(initialData.email)

  // Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwStatus, setPwStatus] = useState<SectionStatus>('idle')
  const [pwMsg, setPwMsg] = useState('')
  const personalInFlightRef = useRef(false)
  const contactInFlightRef = useRef(false)
  const passwordInFlightRef = useRef(false)
  const personalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passwordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (personalTimerRef.current) clearTimeout(personalTimerRef.current)
    if (contactTimerRef.current) clearTimeout(contactTimerRef.current)
    if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current)
  }, [])

  async function handlePersonalSave(e: React.FormEvent) {
    e.preventDefault()
    if (personalInFlightRef.current) return
    personalInFlightRef.current = true
    setPersonalStatus('loading')
    setPersonalMsg('')
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setPersonalStatus('error')
        setPersonalMsg('Sessão expirada. Entre novamente.')
        return
      }
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null })
        .eq('id', user.id)
        .select('id')
        .maybeSingle()
      if (error || !updatedProfile) {
        setPersonalStatus('error')
        setPersonalMsg('Não foi possível salvar o nome. Tente novamente.')
        return
      }

      setPersonalStatus('success')
      setPersonalMsg('Nome atualizado com sucesso!')
      router.refresh()
      if (personalTimerRef.current) clearTimeout(personalTimerRef.current)
      personalTimerRef.current = setTimeout(() => setPersonalStatus('idle'), 3000)
    } catch {
      setPersonalStatus('error')
      setPersonalMsg('Não foi possível salvar o nome. Verifique sua conexão e tente novamente.')
    } finally {
      personalInFlightRef.current = false
    }
  }

  async function handleContactSave(e: React.FormEvent) {
    e.preventDefault()
    if (contactInFlightRef.current) return
    contactInFlightRef.current = true
    setContactStatus('loading')
    setContactMsg('')
    const nextEmail = email.trim()
    if (!nextEmail) {
      setContactStatus('error')
      setContactMsg('Informe um e-mail válido.')
      contactInFlightRef.current = false
      return
    }

    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setContactStatus('error')
        setContactMsg('Sessão expirada. Entre novamente.')
        return
      }

      let emailRequestSent = false
      if (nextEmail !== lastRequestedEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail })
        if (emailError) {
          setContactStatus('error')
          setContactMsg('Não foi possível atualizar o e-mail. Verifique o endereço informado e tente novamente.')
          return
        }
        emailRequestSent = true
        setLastRequestedEmail(nextEmail)
      }

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() || null, address: address.trim() || null })
        .eq('id', user.id)
        .select('id')
        .maybeSingle()

      if (profileError || !updatedProfile) {
        setContactStatus('error')
        setContactMsg(emailRequestSent
          ? 'A confirmação do novo e-mail foi enviada, mas telefone e endereço não foram salvos. Tente salvar esses dados novamente.'
          : 'Não foi possível salvar telefone e endereço. Tente novamente.')
        return
      }

      setContactStatus('success')
      setContactMsg(emailRequestSent || nextEmail !== initialData.email
        ? 'Dados salvos! Siga as instruções enviadas aos endereços envolvidos para confirmar a alteração de e-mail.'
        : 'Dados de contato atualizados com sucesso!')
      if (contactTimerRef.current) clearTimeout(contactTimerRef.current)
      contactTimerRef.current = setTimeout(() => setContactStatus('idle'), 4000)
    } catch {
      setContactStatus('error')
      setContactMsg('Não foi possível salvar os dados de contato. Verifique sua conexão e tente novamente.')
    } finally {
      contactInFlightRef.current = false
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwStatus('error'); setPwMsg('As senhas não coincidem.'); return
    }
    if (newPassword.length < 8) {
      setPwStatus('error'); setPwMsg('A senha deve ter no mínimo 8 caracteres.'); return
    }
    if (passwordInFlightRef.current) return
    passwordInFlightRef.current = true
    setPwStatus('loading')
    setPwMsg('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwStatus('error')
        setPwMsg('Não foi possível atualizar a senha. Verifique os requisitos e tente novamente.')
        return
      }

      setPwStatus('success')
      setPwMsg('Senha alterada com sucesso!')
      setNewPassword('')
      setConfirmPassword('')
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current)
      passwordTimerRef.current = setTimeout(() => setPwStatus('idle'), 3000)
    } catch {
      setPwStatus('error')
      setPwMsg('Não foi possível atualizar a senha. Verifique sua conexão e tente novamente.')
    } finally {
      passwordInFlightRef.current = false
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Dados pessoais ── */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6" aria-labelledby="personal-heading">
        <h2 id="personal-heading" className="font-display text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Dados pessoais
        </h2>
        <form onSubmit={handlePersonalSave} className="space-y-4" aria-busy={personalStatus === 'loading'}>
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              Nome completo
            </label>
            <input
              id="full-name"
              type="text"
              autoComplete="name"
              maxLength={120}
              disabled={personalStatus === 'loading'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
            />
          </div>
          <StatusFeedback status={personalStatus} message={personalMsg} />
          <button
            type="submit"
            disabled={personalStatus === 'loading'}
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {personalStatus === 'loading' ? 'Salvando...' : 'Salvar nome'}
          </button>
        </form>
      </section>

      {/* ── Contato e endereço ── */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="font-display text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <Mail className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Contato e endereço
        </h2>
        <form onSubmit={handleContactSave} className="space-y-4" aria-busy={contactStatus === 'loading'}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={contactStatus === 'loading'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              Telefone / WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                disabled={contactStatus === 'loading'}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
              />
            </div>
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              Endereço
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                id="address"
                rows={2}
                autoComplete="street-address"
                maxLength={300}
                disabled={contactStatus === 'loading'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade, estado"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all resize-none"
              />
            </div>
          </div>
          <StatusFeedback status={contactStatus} message={contactMsg} />
          <button
            type="submit"
            disabled={contactStatus === 'loading'}
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {contactStatus === 'loading' ? 'Salvando...' : 'Salvar contato'}
          </button>
        </form>
      </section>

      {/* ── Senha ── */}
      <section className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 p-6" aria-labelledby="password-heading">
        <h2 id="password-heading" className="font-display text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <Lock className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Alterar senha
        </h2>
        <form onSubmit={handlePasswordSave} className="space-y-4" aria-busy={pwStatus === 'loading'}>
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="new-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                disabled={pwStatus === 'loading'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                disabled={pwStatus === 'loading'}
                className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-science-400 dark:hover:bg-white/5 dark:hover:text-white"
                aria-label={showPw ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-700 dark:text-science-100 mb-1.5">
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="confirm-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                disabled={pwStatus === 'loading'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-science-500 transition-all"
              />
            </div>
          </div>
          <StatusFeedback status={pwStatus} message={pwMsg} />
          <button
            type="submit"
            disabled={pwStatus === 'loading' || !newPassword || !confirmPassword}
            className="px-5 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwStatus === 'loading' ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </section>
    </div>
  )
}

/** Componente de feedback de status reutilizável. */
function StatusFeedback({ status, message }: { status: SectionStatus; message: string }) {
  if (!message) return null
  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-lg px-3 py-2">
        <CheckCircle className="h-4 w-4 shrink-0" />
        {message}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message}
      </div>
    )
  }
  return null
}
