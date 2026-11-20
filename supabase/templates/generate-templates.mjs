// Gera os templates HTML de e-mail de autenticacao (Vet do Rim · vetdorim.com.br).
// Todos os links apontam para o proprio site (sem expor o dominio do Supabase).
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const templates = [
  {
    file: 'recovery.html',
    type: 'recovery',
    title: 'Redefina sua senha',
    body: 'Recebemos uma solicitação para redefinir a senha da sua conta em <strong>vetdorim.com.br</strong>. Clique no botão abaixo para cadastrar uma nova senha:',
    button: 'Criar nova senha',
    footer: 'Este link é de uso único e expira por segurança. Se você não solicitou esta alteração, ignore este e-mail: sua senha atual continuará funcionando normalmente.',
  },
  {
    file: 'confirmation.html',
    type: 'signup',
    title: 'Confirme seu e-mail',
    body: 'Bem-vindo(a) ao <strong>Vet do Rim</strong>! Confirme seu endereço de e-mail para ativar sua conta em <strong>vetdorim.com.br</strong>:',
    button: 'Confirmar e-mail',
    footer: 'Se você não criou uma conta no Vet do Rim, ignore este e-mail.',
  },
  {
    file: 'email_change.html',
    type: 'email_change',
    title: 'Confirme a alteração de e-mail',
    body: 'Recebemos um pedido para alterar o e-mail de acesso da sua conta em <strong>vetdorim.com.br</strong>. Confirme a alteração no botão abaixo:',
    button: 'Confirmar alteração',
    footer: 'Se você não solicitou esta mudança, ignore este e-mail e considere redefinir sua senha.',
  },
  {
    file: 'magic_link.html',
    type: 'magiclink',
    title: 'Seu link de acesso',
    body: 'Use o botão abaixo para entrar com segurança no <strong>Vet do Rim</strong> (<strong>vetdorim.com.br</strong>):',
    button: 'Entrar no Vet do Rim',
    footer: 'Este link é de uso único e expira por segurança. Se você não pediu este acesso, ignore este e-mail.',
  },
  {
    file: 'invite.html',
    type: 'invite',
    title: 'Você foi convidado(a)',
    body: 'Você recebeu um convite para acessar o <strong>Vet do Rim · Lab Evolution</strong> em <strong>vetdorim.com.br</strong>. Aceite o convite no botão abaixo:',
    button: 'Aceitar convite',
    footer: 'Se você não esperava este convite, ignore este e-mail.',
  },
]

function render({ type, title, body, button, footer }) {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a; background-color: #ffffff;">
  <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #0f766e; margin: 0 0 12px;">
    Vet do Rim · Lab Evolution
  </p>
  <h2 style="font-size: 22px; margin: 0 0 12px; color: #0f172a;">${title}</h2>
  <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
    ${body}
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=${type}"
       style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 10px;">
      ${button}
    </a>
  </p>
  <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 20px 0 0;">
    ${footer}
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
    Vet do Rim · <a href="https://www.vetdorim.com.br" style="color: #0f766e; text-decoration: none;">www.vetdorim.com.br</a>
  </p>
</div>
`
}

for (const template of templates) {
  writeFileSync(join(here, template.file), render(template), 'utf8')
  console.log(`Gerado ${template.file}`)
}
