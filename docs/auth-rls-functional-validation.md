# Auth/RLS Functional Validation

Status: validado com usuarios E2E temporarios em 2026-06-25.

## Estado atual

- Banco remoto Supabase esta com migrations aplicadas ate `20260625051920_rls_performance_advisor_cleanup.sql`.
- Performance Advisor passou sem issues.
- Security Advisor mantem apenas `auth_leaked_password_protection`, recurso bloqueado no plano Free do Supabase.
- `public.profiles.role` aceita `vet`, `tutor` e `admin`.
- Testes E2E por papel foram executados com usuarios temporarios criados via Admin API e excluidos ao final.
- Verificacao final confirmou `0` usuarios E2E temporarios restantes.

## Variaveis de ambiente E2E

Configure apenas no terminal local ou em segredo de CI. Nao versionar.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://ycclyzoslirpnnwgzrqx.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="..."

$env:E2E_ADMIN_EMAIL="admin@example.com"
$env:E2E_ADMIN_PASSWORD="..."

$env:E2E_VET_EMAIL="vet@example.com"
$env:E2E_VET_PASSWORD="..."

$env:E2E_TUTOR_EMAIL="tutor@example.com"
$env:E2E_TUTOR_PASSWORD="..."
```

Compatibilidade: `E2E_SUPABASE_EMAIL` e `E2E_SUPABASE_PASSWORD` ainda funcionam como credenciais legadas para um usuario autenticado.

## Matriz de validacao

| Papel | Precondicao | Fluxo | Resultado esperado |
| --- | --- | --- | --- |
| Anonimo | Sem sessao | Acessar `/lab` | Redireciona para `/auth/login?redirectTo=%2Flab` |
| Vet | `profiles.role = 'vet'` | Login com `redirectTo=/lab` | Acessa `/lab` |
| Vet | `profiles.role = 'vet'` | Acessar `/portal` | Redireciona para `/lab` |
| Admin | `profiles.role = 'admin'` | Login com `redirectTo=/lab` | Acessa `/lab` |
| Admin | `profiles.role = 'admin'` | Acessar `/portal` | Redireciona para `/lab` |
| Tutor | `profiles.role = 'tutor'` | Login com `redirectTo=/lab` | Redireciona para `/portal` |
| Tutor | `profiles.role = 'tutor'` | Acessar `/lab` | Redireciona para `/portal` |

## Comandos

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run test:e2e
```

Para rodar apenas Auth/RLS:

```powershell
npm run test:e2e:auth-rls
```

O script `test:e2e:auth-rls` cria usuarios temporarios `admin`, `vet` e `tutor`, ajusta `public.profiles.role`, executa Playwright e exclui os usuarios no `finally`.

## Resultados da ultima bateria

| Verificacao | Resultado |
| --- | --- |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm run build` | Passou |
| `npm run test:e2e` com env real temporaria | 6 passed, 4 skipped |
| `npm run test:e2e:auth-rls` | 4 passed, 1 skipped |
| Performance Advisor | No issues found |
| Security Advisor | Apenas leaked password protection no plano Free |

## Consultas read-only uteis

```powershell
supabase db query "select role, count(*) from public.profiles group by role order by role;" --linked
supabase db query "select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname in ('public','storage') order by schemaname, tablename, policyname;" --linked
```

## Bloqueios

- `web/.env.local` local usa Supabase dummy por seguranca. Para E2E local completo, usar env real temporaria ou `npm run test:e2e:auth-rls`.
- Criar usuarios ou alterar `profiles.role` e acao critica de Auth/Banco e exige confirmacao explicita antes de executar.
- Leaked password protection so pode ser habilitado em plano Pro ou superior.
- O token Supabase exposto anteriormente foi rotacionado pelo responsavel do projeto e deve permanecer revogado.
