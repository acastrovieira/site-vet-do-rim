# Checklist — Reconciliação de Auth do Supabase (Dashboard vs. config.toml local)

Público-alvo: Dr. Anderson, clicando no Dashboard do Supabase (não precisa saber programar).
Objetivo: garantir que as configurações de autenticação do projeto **remoto/produção**
(`https://vetdorim.com.br`) estejam corretas — porque `supabase/config.toml`, versionado no
repositório, só vale para o ambiente **local** de desenvolvimento. Ele não muda nada
automaticamente no projeto hospedado. Cada linha abaixo é uma tela do Dashboard que precisa
ser conferida/ajustada manualmente.

Baseado em: `supabase/config.toml` (lido por completo) e no ponto "P1 — configuração
Auth/Edge remota não reconciliada" da auditoria de 2026-07-16, que diz:

> `supabase/config.toml` local agora declara senha mínima de 8 caracteres e troca segura de
> senha, mas mantém signup aberto, confirmação de email/MFA e restrições de rede desativadas,
> além de PostgreSQL 17. Isso é evidência da configuração local, **não prova** o estado
> remoto (...). S0/S5 devem reconciliar Dashboard × config versionada e testar o contrato
> sem expor detalhes.

Este checklist é exatamente esse trabalho de reconciliação, em formato clique-a-clique.

---

## Como navegar no Dashboard

Todos os itens abaixo ficam em:
`https://supabase.com/dashboard/project/<seu-project-ref>/auth/providers` e
`.../auth/policies` (o Supabase reorganiza os nomes das abas de vez em quando; procure por
"Authentication" no menu lateral esquerdo e depois pelas sub-abas **Providers**,
**Sign In / Providers**, **Policies** ou **Settings**, dependendo da versão da interface).

---

## 1. Signup (cadastro aberto vs. fechado)

**Estado local (config.toml):** `enable_signup = true` (linha 183) — cadastro aberto para
qualquer pessoa, sem exigir confirmação de email antes de logar
(`auth.email.enable_confirmations = false`, linha 233).

**Estado desejado em produção:** cadastro pode continuar aberto (é um produto de tutores se
auto-cadastrando), **mas confirmação de email deve ser obrigatória antes do primeiro login**.
Sem isso, qualquer pessoa cria conta com um email que não é dela e já entra no sistema.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Sign In / Providers > Email**.
2. Confirme se **"Enable email provider"** está ligado (deve estar, é o método principal).
3. Localize a opção **"Confirm email"** (às vezes aparece como "Enable email confirmations"
   dentro de Authentication > Settings, seção "User Signups").
4. **Ligue essa opção.** Isso obriga o usuário a clicar no link do email antes de poder
   logar.
5. Confira que existe um template de email de confirmação configurado (Authentication >
   Emails > Confirm signup) e que o remetente/SMTP está funcional — sem isso, o usuário fica
   preso sem conseguir confirmar.

**Não exige upgrade de plano.** Disponível no plano Free.

---

## 2. Proteção contra senha vazada (leaked password protection / HaveIBeenPwned)

**Estado local:** não existe nenhuma configuração equivalente em `config.toml` — esse
recurso não é controlado pelo CLI/config local, só existe como opção do projeto hospedado.

**Estado desejado:** ativado. O Supabase verifica, no momento do cadastro/troca de senha, se
aquela senha já apareceu em vazamentos conhecidos (via HaveIBeenPwned) e recusa se sim.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Policies** (ou **Authentication > Settings**, seção
   "Password Security"/"Advanced").
2. Procure **"Leaked password protection"** (ou "Prevent use of leaked passwords").
3. Ative.

**⚠️ Exige upgrade de plano.** Este recurso é exclusivo do **plano Pro** (ou superior) do
Supabase. No plano Free, a opção aparece desabilitada/bloqueada com um selo de upgrade. Se o
projeto ainda estiver no Free, isso fica pendente até a decisão de negócio de migrar de
plano — registrar como item de decisão para o Dr. Anderson/responsável financeiro.

---

## 3. Tamanho e complexidade mínima de senha

**Estado local:** `minimum_password_length = 8` (linha 189) — correto e alinhado com o
esperado. `password_requirements = ""` (linha 192) — ou seja, não exige mistura de
maiúsculas/minúsculas/números/símbolos, só o tamanho mínimo.

**Estado desejado:** mínimo de 8 caracteres é aceitável como piso. Recomenda-se subir a
régua de complexidade, já que é um sistema de saúde com dados clínicos e de tutores.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Policies** (seção "Password Requirements" ou similar).
2. Confirme **"Minimum password length"** = 8 (mínimo aceitável; pode subir para 10-12 se
   quiser reforçar).
3. Em **"Password requirements"**, considere selecionar pelo menos
   `Lowercase, uppercase letters and digits` (equivalente a
   `lower_upper_letters_digits` no config.toml) em vez de deixar sem exigência nenhuma.

**Não exige upgrade de plano.**

---

## 4. MFA (autenticação multifator)

**Estado local:** tudo desativado — `auth.mfa.totp.enroll_enabled = false`,
`verify_enabled = false` (linhas 310-311), `auth.mfa.phone` também desativado
(linhas 315-316), WebAuthn comentado/desativado (linhas 322-324).

**Estado desejado:** pelo menos TOTP (aplicativo autenticador, tipo Google Authenticator)
disponível como opção — obrigatório para papéis administrativos/veterinários seria o ideal,
opcional para tutores.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Providers > Multi-Factor Authentication (MFA)**.
2. Ative **"Authenticator App (TOTP)"**.
3. Avalie se WebAuthn (chave de segurança/biometria) também vale a pena habilitar — mais
   avançado, pode ficar para uma fase posterior.

**⚠️ Verificar plano.** O comentário do próprio `config.toml` (linha 303) diz
"Multi-factor-authentication is available to Supabase Pro plan" — ou seja, MFA completo
(incluindo enforcement por política) é recurso pago. TOTP básico pode estar disponível no
Free em alguns projetos, mas a aplicação de MFA obrigatório por papel normalmente depende de
regras customizadas (RLS/hooks) que o time de banco precisa implementar depois — isso é
trabalho de código, não só de clique no Dashboard. Registrar como item de decisão de
plano + backlog técnico.

---

## 5. Site URL e Redirect URLs (o item mais crítico para produção)

**Estado local:** `site_url = "http://localhost:3000"` (linha 159) e
`additional_redirect_urls` (linhas 163-170) só contém `localhost`/`127.0.0.1` nas portas de
desenvolvimento e teste (3000, 3310, 3312). O próprio comentário do arquivo já avisa
(linha 162): *"Local-only allowlist. Production must use its exact HTTPS callback in the
hosted Auth settings."*

**Estado desejado em produção:** `https://vetdorim.com.br` como Site URL, e as URLs de
redirect de produção na allowlist — nada de `localhost` na configuração do projeto de
produção.

**O que fazer no Dashboard:**
1. Vá em **Authentication > URL Configuration**.
2. Em **"Site URL"**, coloque exatamente `https://vetdorim.com.br` (sem barra no final,
   confirme se o domínio final em produção é esse mesmo, com ou sem `www`).
3. Em **"Redirect URLs"**, adicione:
   - `https://vetdorim.com.br/**` (padrão wildcard, cobre todas as rotas)
   - Se existir um domínio de staging/preview (ex.: Vercel preview deployments), adicione
     também o padrão correspondente, por exemplo `https://*.vercel.app/**` — mas **só se o
     time realmente usar preview deployments com login**; caso contrário, não adicione
     domínios genéricos demais, isso amplia a superfície de ataque para redirecionamento de
     login.
   - **Não deixe nenhuma URL `localhost`/`127.0.0.1` na lista do projeto de produção.**
     Isso é só para o `config.toml` local.
4. Salve e teste (ver seção "Verificação final" abaixo).

**Não exige upgrade de plano.**

---

## 6. Restrições de rede do banco de dados

**Estado local:** `db.network_restrictions.enabled = false` (linha 75), com
`allowed_cidrs = ["0.0.0.0/0"]` — ou seja, sem nenhuma restrição de IP, qualquer endereço
pode tentar conectar diretamente ao Postgres.

**Estado desejado:** avaliar se o projeto de produção deveria restringir conexões diretas ao
banco (porta 5432/6543) a IPs conhecidos (ex.: IPs da Vercel, do time, de serviços
autorizados), em vez de aberto para a internet inteira. Isso é uma camada extra de defesa —
a autenticação por senha do Postgres continua existindo, mas reduzir a superfície de ataque
é uma boa prática, especialmente por ser um sistema de dados clínicos/PII.

**O que fazer no Dashboard:**
1. Vá em **Settings > Database > Network Restrictions** (no projeto hospedado, não é a
   mesma tela do `config.toml` local).
2. Se o time souber os CIDRs de origem confiáveis, restrinja. Se não souber (ex.: Vercel usa
   IPs dinâmicos), considerar manter aberto por ora, mas depender do Connection Pooler + SSL
   obrigatório como mitigação, e revisar isso quando a arquitetura de rede estiver madura.

**Pode exigir plano pago dependendo do nível de granularidade** (verificar na tela; algumas
opções básicas de restrição de IP existem no Free, regras mais avançadas podem ser Pro).

---

## 7. CAPTCHA no cadastro/login

**Estado local:** `[auth.captcha]` está comentado/desativado — nenhum CAPTCHA configurado.

**Estado desejado:** como o cadastro é aberto (`enable_signup = true`), recomenda-se CAPTCHA
(hCaptcha ou Cloudflare Turnstile) no formulário de cadastro/login para reduzir bots e
cadastros automatizados em massa.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Bot and Abuse Protection** (ou **Authentication > Settings**,
   seção CAPTCHA).
2. Escolha um provedor (hCaptcha ou Turnstile), crie uma conta no provedor escolhido, gere
   a site key/secret key.
3. Cole a secret key no Dashboard (nunca no repositório de código).
4. No frontend, será necessário adicionar o widget de CAPTCHA correspondente no formulário —
   **isso é trabalho de código**, encaminhar para o time de frontend depois de decidir o
   provedor.

**Não exige upgrade de plano do Supabase** (mas o provedor de CAPTCHA pode ter seu próprio
plano gratuito com limites — hCaptcha e Turnstile têm camada gratuita generosa).

---

## 8. Versão do Postgres

**Estado local:** `major_version = 17` (linha 42, seção `[db]`).

**Estado desejado:** o projeto de produção no Supabase precisa estar na mesma versão maior
(Postgres 17), senão migrations testadas localmente podem se comportar diferente em
produção.

**O que fazer no Dashboard:**
1. Vá em **Settings > Infrastructure** (ou **Database > Settings**) e confira a versão do
   Postgres do projeto de produção.
2. Se estiver em versão anterior (ex.: 15), avaliar com o time um upgrade controlado (o
   Supabase tem um fluxo de upgrade assistido, mas requer downtime/janela de manutenção
   planejada — não faça isso sem avisar).

---

## 9. Rate limits de autenticação

**Estado local:** já configurados de forma razoável —
`email_sent = 2`/hora, `sign_in_sign_ups = 30`/5min por IP, `token_refresh = 150`/5min,
`token_verifications = 30`/5min (linhas 205-218).

**Estado desejado:** esses valores são recomendações de fábrica razoáveis. Não é um item
de correção obrigatória, mas vale conferir se o Dashboard do projeto de produção tem os
mesmos limites (podem ter sido alterados manualmente por engano em algum momento).

**O que fazer no Dashboard:**
1. Vá em **Authentication > Rate Limits**.
2. Compare os valores exibidos com os do `config.toml` (seção acima). Não precisam ser
   idênticos, mas não devem estar muito mais permissivos sem motivo (ex.: 30 emails/hora em
   vez de 2 seria um sinal de alerta para abuso).

---

## 10. SMTP de produção (envio real de emails)

**Estado local:** `[auth.email.smtp]` está comentado (linhas 244-251) e o ambiente local usa
o Inbucket (servidor de teste, linhas 105-112) — nenhum email sai de verdade.

**Estado desejado:** o projeto de produção **precisa** de um SMTP próprio configurado
(SendGrid, Amazon SES, Postmark, Resend etc.). O serviço de email embutido do Supabase é
apenas para desenvolvimento/testes e tem limite muito baixo (poucos emails por hora,
compartilhado) — **não é suportado para produção**. Sem SMTP próprio, a confirmação de email
(item 1) e o reset de senha vão falhar silenciosamente ou cair em spam assim que houver
volume real. Este item é pré-requisito direto do item 1.

**O que fazer no Dashboard:**
1. Vá em **Authentication > Emails > SMTP Settings** (ou **Project Settings > Auth > SMTP**).
2. Ative **"Enable Custom SMTP"** e preencha host, porta (587/STARTTLS), usuário e senha do
   provedor escolhido.
3. Configure o **sender email** com um domínio próprio (ex.: `nao-responda@vetdorim.com.br`)
   e conclua a verificação de domínio do provedor (SPF, DKIM e, de preferência, DMARC) para
   não cair em spam.
4. A senha/API key do SMTP vai **só no Dashboard** (ou como secret do projeto), nunca no
   repositório — no `config.toml` local ela aparece como `env(SENDGRID_API_KEY)` justamente
   por isso.
5. Depois de configurar, revise os rate limits de email (item 9): com SMTP próprio dá para
   subir `email_sent` acima de 2/hora com segurança.

**Não exige upgrade de plano do Supabase** (o provedor de SMTP pode ter seu próprio custo,
mas quase todos têm camada gratuita suficiente para o início).

---

## 11. Higiene e rotação de chaves de API/JWT

**Estado local:** o `config.toml` não versiona nenhuma chave (correto), e o comentário da
linha 175-176 reforça *"DO NOT commit your signing keys file to git"*. Mas o estado das
chaves do projeto **remoto** não é observável pelo config — precisa ser conferido no
Dashboard.

**Estado desejado:** o projeto de produção deve estar migrado (ou em migração) do modelo
**legado** (segredo JWT simétrico único + chaves `anon`/`service_role` longevas) para o novo
modelo de chaves do Supabase: **publishable key** (pública, substitui a `anon`) e **secret
key** (substitui a `service_role`), com **JWT signing keys** assimétricas rotacionáveis. Isso
importa muito num SaaS com PII veterinária: a `service_role`/secret key ignora RLS e, se
vazar, dá acesso total aos dados clínicos.

**O que fazer no Dashboard:**
1. Vá em **Project Settings > API Keys** (e **> JWT Keys**).
2. Verifique se o projeto já usa **publishable/secret keys**. Se ainda estiver só no modelo
   legado (`anon`/`service_role` + JWT secret), planeje a migração para as novas chaves
   assimétricas (o Supabase tem fluxo assistido; a rotação de JWT permite duas chaves ativas
   durante a transição, sem derrubar sessões).
3. Confirme que a **secret key / `service_role`** **nunca** é exposta ao frontend nem
   commitada — ela só deve viver em variáveis de ambiente de servidor (Edge Functions,
   backend, secrets do CI de deploy). Só a publishable/`anon` pode ir para o cliente.
4. Se houver qualquer suspeita de que uma chave legada foi exposta (em log, screenshot, repo
   antigo, ticket), **rotacione imediatamente** e invalide a anterior.
5. Registre a data da última rotação e defina uma cadência de rotação (ex.: revisar a cada
   6-12 meses ou sempre que alguém com acesso sair do time).

**Não exige upgrade de plano.**

---

## Resumo em tabela

| Item | Estado local (config.toml) | Estado desejado em produção | Exige upgrade de plano? |
|---|---|---|---|
| Confirmação de email | Desativada | **Ativada** | Não |
| Proteção de senha vazada | Não existe no config.toml | **Ativada** | **Sim — Pro** |
| Senha mínima | 8 caracteres, sem complexidade | 8+ caracteres, considerar complexidade | Não |
| MFA (TOTP) | Desativado | Ativar ao menos TOTP | **Avaliar — Pro para enforcement completo** |
| Site URL | `localhost:3000` | `https://vetdorim.com.br` | Não |
| Redirect URLs | Só localhost/127.0.0.1 | Domínio de produção (+ staging se aplicável) | Não |
| Restrições de rede do banco | Desativadas (0.0.0.0/0) | Avaliar restringir por CIDR | Avaliar (parcial no Free) |
| CAPTCHA | Desativado | Ativar hCaptcha/Turnstile | Não (Supabase); provedor tem free tier |
| Versão Postgres | 17 (local) | Confirmar 17 em produção | Não (mas upgrade pode ter downtime) |
| Rate limits | Configurados, razoáveis | Confirmar paridade com produção | Não |
| SMTP de produção | Comentado (usa Inbucket local) | **SMTP próprio + SPF/DKIM** (pré-req. do item 1) | Não (Supabase); provedor tem free tier |
| Higiene/rotação de chaves | Não versionadas (correto) | Migrar p/ publishable/secret + JWT assimétrico; proteger `service_role` | Não |

---

## Verificação final — como provar que ficou correto

Depois de aplicar os itens acima, valide (sem expor nenhum segredo em log ou print
compartilhado publicamente):

1. **Signup + confirmação de email:**
   - Crie uma conta de teste com um email real que você controla.
   - Confirme que o sistema **não deixa logar** antes de clicar no link de confirmação
     recebido por email.
   - Confirme que o link de confirmação recebido aponta para `https://vetdorim.com.br`
     (nunca para `localhost`).

2. **Redirect URL:**
   - Faça login/logout completo pelo domínio de produção e confirme que, depois de
     confirmar email ou resetar senha, o usuário é redirecionado de volta para
     `https://vetdorim.com.br` (não para uma tela de erro "redirect URL not allowed").

3. **Senha fraca é recusada:**
   - Tente cadastrar com uma senha de 6 caracteres — deve ser recusada.
   - Se ativou proteção de senha vazada: tente uma senha conhecida por ter vazado
     (ex.: `password123`) — deve ser recusada com mensagem específica sobre senha
     comprometida (só funciona se estiver no plano Pro com o recurso ativo).

4. **MFA (se ativado):**
   - Em uma conta de teste, ative TOTP e confirme que, ao deslogar e logar de novo, o
     sistema pede o código do autenticador antes de liberar acesso.

5. **CAPTCHA (se ativado):**
   - Confirme visualmente que o widget de CAPTCHA aparece no formulário de cadastro em
     produção (isso depende do time de frontend ter integrado o widget — ver item 7).

6. **Nenhum dado sensível exposto:**
   - Ao fazer esses testes, não printe nem cole tokens, chaves de API, ou senhas em
     nenhum lugar (chat, ticket, documento). Só descreva o resultado ("passou"/"falhou").

7. **Registre o resultado:** depois de rodar esta verificação, atualize a seção "P1 —
   configuração Auth/Edge remota não reconciliada" da auditoria de produção
   (`docs/auditoria-production-readiness-2026-07-16.md`) ou crie uma nota de acompanhamento
   confirmando que o Dashboard e o `config.toml` estão reconciliados, com a data em que isso
   foi verificado.

---

## Notas finais

- Este checklist assume que quem está clicando tem acesso de **Owner/Admin** ao projeto no
  Dashboard do Supabase. Se o Dr. Anderson não tiver essas permissões, será necessário
  primeiro garantir o acesso correto (Settings > Team) antes de seguir este checklist.
- Nenhum valor de chave, token ou segredo foi incluído neste documento — só nomes de telas,
  nomes de opções e o que fazer com elas.
- Itens marcados como "exige upgrade de plano" devem ser levados para decisão de negócio
  (custo x risco) antes de qualquer prazo de produção ser assumido como compromisso.
