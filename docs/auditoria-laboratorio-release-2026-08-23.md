# Auditoria final do laboratório — 2026-08-23

## Veredito

**GO local com dados sintéticos para o fluxo de extração/revisão; NO-GO para
produção e dados clínicos reais.** Nenhum banco remoto, produção, deploy ou
dado real foi acessado ou alterado nesta execução.

O fluxo local sem API paga foi implementado e provado de ponta a ponta:
PDF digital ou OCR local, revisão humana obrigatória, upload privado, gravação,
tabela evolutiva e exportação CSV/XLSX. O caminho passou em Chrome desktop,
celular, tablet e WebKit/Safari.

## Correções concluídas

- extração no navegador com PDF.js e OCR Tesseract same-origin, sem OpenAI,
  Gemini ou outra API paga;
- parser determinístico com números pt-BR/en-US, aliases, unidades, faixas,
  qualificadores, duplicatas e ambiguidades tratados de forma fail-closed;
- revisão humana obrigatória antes da persistência;
- correção da perda do rascunho durante o upload;
- rota server-side de persistência com autenticação, membership exata,
  validação estrita e update final estreito;
- tabela e exportação consumindo a mesma evidência revisada;
- neutralização de fórmula em CSV e geração segura de XLSX;
- camada clínica canônica: sem conversão silenciosa, sem faixa legada inventada
  e sem tendência entre unidades incompatíveis;
- migration forward de RLS por clínica, grants explícitos, bloqueio de update
  direto do ciclo de vida e wrapper RPC restrito ao service role;
- três correções históricas mínimas e divulgadas no ledger de integridade,
  removendo os bloqueadores objetivos de replay sem afirmar igualdade remota;
- rate limit distribuído/transacional por usuário e operação,
  `429`/`Retry-After` e logs Edge por allowlist;
- preservation hold: Edge e cron legado não removem mais o PDF original;
- responsividade e teste autenticado em desktop, celular, tablet e Safari;
- scripts E2E isolados em porta própria e sem sobrescrever `.env.local`.

## Evidências locais

| Gate | Resultado |
| --- | --- |
| Unitários/contratos | 149/149 aprovados |
| E2E público/predeploy | 76 aprovados, 4 de autenticação remota ignorados por falta de credenciais autorizadas |
| E2E laboratório autenticado | 4/4: Chrome desktop, Pixel 5, tablet 768×1024 e WebKit |
| Replay PostgreSQL 17 | `db reset --local --no-seed` aprovado, 21/21 migrations, em stack descartável com portas isoladas |
| pgTAP segurança/RLS | 99/99 aprovados em 6 arquivos na stack isolada |
| Ensaio backup/restore/rollback | dump sintético com SHA-256, restore em destino limpo, marcador recuperado, 99/99 pgTAP e rollback transacional aprovados |
| Build Next.js | aprovado, 29 páginas geradas |
| TypeScript / ESLint | aprovados |
| Migrations / Edge / Sprint 3 | contratos estáticos aprovados |
| Deno / contrato Edge | Deno 2.9.5 instalado; `deno check` aprovado |
| Dependências npm | 0 vulnerabilidades conhecidas no audit executado |

## Bloqueadores P0 antes de produção

1. **Reconciliação remota das transições históricas continua pendente.** O
   replay local encontrou e agora corrige três migrations impeditivas:
   - `20260823000000`: usa `tablename/indexname` em
     `pg_stat_user_indexes`, cujas colunas corretas são
     `relname/indexrelname`;
   - `20260823000100`: chama `public.current_user_is_admin()` depois da função
     ter sido movida para `private`;
   - `20260823000300`: executa `CREATE INDEX CONCURRENTLY` dentro de
     `BEGIN/COMMIT`.
   As mudanças mínimas estão no ledger append-only e o replay PostgreSQL 17
   completo passou localmente. Os hashes dos artefatos aplicados remotamente
   continuam desconhecidos; DBA/Architect precisam comparar com staging antes
   de qualquer promoção.
2. **Dados clínicos legados não preservam unidade/faixa por analito.** Não é
   seguro classificar plaquetas/leucograma ou comparar tendência: a escala pode
   diferir por fator 1.000. A normalização legada e seu `status_ref` devem ficar
   bloqueados.
3. **Validação clínica humana pendente.** Patologista veterinário deve homologar
   nomenclatura, unidade, método/equipamento, faixas versionadas, qualificadores,
   conversões e flags pré-analíticas por laboratório.
4. **Política de retenção do PDF original pendente.** O descarte automático foi
   neutralizado localmente e o original privado agora é preservado. Architect,
   Security e DPO ainda devem aprovar finalidade, prazo, acesso, legal hold,
   purge, backups/réplicas e atendimento aos direitos LGPD.
5. **Staging não foi executado.** O Deno 2.9.5 foi instalado e o contrato da
   Edge Function passou em `deno check`, mas ainda faltam confirmação inequívoca
   de que o alvo não é produção, `SUPABASE_PROJECT_REF` compatível com a URL,
   `SUPABASE_SERVICE_ROLE_KEY` e credencial do banco de staging. Backup,
   restore, rollback, limite complementar no WAF/gateway e logs do ambiente
   também dependem de execução humana em staging. Um ensaio local descartável
   de backup/restore/rollback passou, mas não atesta o serviço gerenciado nem o
   Storage do provedor.

## Plano por sprint, modelo e squad

| Sprint | Modelo / agente | Squad | Entrega local | Pendência |
| --- | --- | --- | --- | --- |
| S0 Segurança e banco | GPT-5.6-sol high / Supabase Security Auditor | Backend, DBA, AppSec | RLS clinic-scoped, grants, RPC, pgTAP | reconciliar migrations históricas e aplicar somente em staging aprovado |
| S1 Integridade clínica | GPT-5.6-sol high / Clinical Data Validator | Patologia veterinária, QA clínico, Data | observação canônica fail-closed e fixtures | homologação por patologista e política do original |
| S2 Fluxo funcional/responsivo | GPT-5.6-terra high / QA Automation | Frontend, Backend, QA | upload, revisão, save, tabela, CSV/XLSX; 4 navegadores/viewports | repetir com corpus anônimo representativo em staging |
| S3 Release/LGPD | GPT-5.6-terra medium / Release-SRE Auditor | SRE, Security, DPO, DBA | contador distribuído no Postgres, logs sanitizados e runbook | WAF/gateway complementar, backup/restore/rollback e aprovação LGPD |

## Execução mastigada que depende do responsável humano

### 0. Restaurar a configuração local

O arquivo `web/.env.local` está apontando somente para a stack local descartável
usada no teste e não contém mais as variáveis server-side anteriores. Antes de
rodar a aplicação, recrie-o a partir de `web/.env.example`, copiando os valores
do cofre/Vercel/Supabase; nunca cole chaves em chat, issue ou commit. Confirme
que o arquivo continua ignorado pelo Git.

### 1. Preparar staging sem executar mutação

1. Abra PowerShell no diretório `web`.
2. Preencha localmente as variáveis descritas em `web/.env.example`.
3. Defina explicitamente `SUPABASE_ENVIRONMENT=staging`.
4. Confira se `SUPABASE_PROJECT_REF`, URL, host e usuário pertencem ao mesmo
   projeto e obtenha confirmação formal de que ele não é produção.
5. Rode `npm run check:remote-readiness -- --remote`. Este passo consulta apenas
   readiness; pare diante de qualquer `failed`.
6. Rode primeiro `npm run audit:staging` (plano sem rede).
7. Com autorização registrada, rode
   `npm run audit:staging -- --remote-read-only`. Não salve a saída em arquivo
   versionado.

### 2. Reconciliar migrations

1. Tire snapshot/backup verificável de staging.
2. Consulte `supabase_migrations.schema_migrations` e os objetos existentes.
3. Compare os três pares exatos de hashes divulgados no manifesto com o estado
   real e preserve `remoteArtifactSha256: null` quando não houver prova byte a
   byte.
4. DBA e Architect revisam as transições divulgadas; não use `migration repair`
   nem altere checksums silenciosamente.
5. Repita em clone/restore isolado: replay do zero, update do estado existente,
   pgTAP, Vet A × Vet B, recepção e service role.
6. Só então abra change ticket para a migration forward. Não aplicar em
   produção diretamente.

### 3. Homologar o dado clínico

1. Separe PDFs anônimos de cada laboratório/layout, incluindo imagens
   escaneadas, tabelas, vírgula/ponto, contagens absolutas e percentuais.
2. Patologista registra a verdade esperada sem identificação do paciente.
3. Rode extração; confira valor bruto, número, unidade, faixa, página e flags.
4. Qualquer conflito, unidade ausente, qualificador ou escala ambígua deve
   permanecer para revisão, nunca ser adivinhado.
5. Somente após concordância documentada, versionar catálogo/conversões.

### 4. Release operacional

Siga `docs/runbooks/sprint-3-release-privacy-backup.md`: WAF distribuído,
inspeção de logs, opt-out de analytics, backup com manifesto, restore isolado,
ensaio de rollback e aprovações de Security, DBA, responsável clínico e DPO.
