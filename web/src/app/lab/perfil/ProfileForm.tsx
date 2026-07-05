'use client'

import { useState, useTransition } from 'react'
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

  // Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwStatus, setPwStatus] = useState<SectionStatus>('idle')
  const [pwMsg, setPwMsg] = useState('')

  const [, startTransition] = useTransition()

  async function handlePersonalSave(e: React.FormEvent) {
    e.preventDefault()
    setPersonalStatus('loading')
    setPersonalMsg('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPersonalStatus('error'); setPersonalMsg('Sessão expirada.'); return }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', user.id)
    if (error) {
      setPersonalStatus('error')
      setPersonalMsg('Erro ao salvar. Tente novamente.')
    } else {
      setPersonalStatus('success')
      setPersonalMsg('Nome atualizado com sucesso!')
      setTimeout(() => setPersonalStatus('idle'), 3000)
    }
  }

  async function handleContactSave(e: React.FormEvent) {
    e.preventDefault()
    setContactStatus('loading')
    setContactMsg('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setContactStatus('error'); setContactMsg('Sessão expirada.'); return }

    // Atualiza e-mail se mudou
    if (email.trim() !== initialData.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: email.trim() })
      if (emailErr) {
        setContactStatus('error')
        setContactMsg('Erro ao atualizar e-mail: ' + emailErr.message)
        return
      }
    }

    // Atualiza telefone e endereço em profiles
    const { error } = await supabase
      .from('profiles')
      .update({ phone: phone.trim() || null, address: address.trim() || null })
      .eq('id', user.id)

    if (error) {
      setContactStatus('error')
      setContactMsg('Erro ao salvar contato. Tente novamente.')
    } else {
      setContactStatus('success')
      setContactMsg(email.trim() !== initialData.email
        ? 'Dados salvos! Verifique seu novo e-mail para confirmar a alteração.'
        : 'Dados de contato atualizados com sucesso!')
      setTimeout(() => setContactStatus('idle'), 4000)
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
    setPwStatus('loading')
    setPwMsg('')
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwStatus('error')
        setPwMsg('Erro ao atualizar senha: ' + error.message)
      } else {
        setPwStatus('success')
        setPwMsg('Senha alterada com sucesso!')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPwStatus('idle'), 3000)
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* ── Dados pessoais ── */}
      <section className="bg-white rounded-2xl border border-slate-100 p-6" aria-labelledby="personal-heading">
        <h2 id="personal-heading" className="font-display text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Dados pessoais
        </h2>
        <form onSubmit={handlePersonalSave} className="space-y-4">
          <div>
            <label htmlFor="full-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome completo
            </label>
            <input
              id="full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all"
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
      <section className="bg-white rounded-2xl border border-slate-100 p-6" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="font-display text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Mail className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Contato e endereço
        </h2>
        <form onSubmit={handleContactSave} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all"
              />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Telefone / WhatsApp
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all"
              />
            </div>
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1.5">
              Endereço
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                id="address"
                rows={2}
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade, estado"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all resize-none"
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
      <section className="bg-white rounded-2xl border border-slate-100 p-6" aria-labelledby="password-heading">
        <h2 id="password-heading" className="font-display text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Lock className="h-5 w-5 text-brand-500" strokeWidth={2} aria-hidden />
          Alterar senha
        </h2>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="new-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPw ? 'Ocultar campo de senha' : 'Mostrar campo de senha'}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="confirm-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400 transition-all"
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
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        <CheckCircle className="h-4 w-4 shrink-0" />
        {message}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message}
      </div>
    )
  }
  return null
}
