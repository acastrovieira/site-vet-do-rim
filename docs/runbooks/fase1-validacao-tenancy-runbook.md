# Runbook — Como validar a Fase 1 (Tenancy / isolamento por clínica)

Público-alvo: Dr. Anderson (sem experiência em CI/CD ou SQL). Este documento explica, em
linguagem direta, o que foi entregue na Fase 1 do ADR-001 (isolamento de dados por clínica),
como confirmar que está tudo certo rodando o CI, o que cada verificação automática realmente
prova, e o que ainda falta — de propósito — para a etapa seguinte (enforcement).

Agente responsável: QA (squad AIOX). Data: 2026-07-18. Análise feita 100% localmente (sandbox
sem rede e sem Postgres); os testes de banco descritos aqui só rodam de verdade dentro do job
"Database Contract" do GitHub Actions.

---

## 1. O que é a Fase 1, em uma frase

A Fase 1 prepara o banco de dados para que, no futuro, cada clínica só enxergue os próprios
tutores, pets, triagens, follow-ups, colaboradores e laudos — sem cortar nada que já funciona
hoje. Ela cria a estrutura (tabela de clínicas, tabela de "quem trabalha em qual clínica") e
marca cada registro existente como pertencente à clínica "Vet do Rim", mas **não troca ainda**
as regras de acesso do sistema atual. Essa troca (chamada de "enforcement") é a etapa seguinte,
propositalmente separada porque é o único passo sem volta fácil.

Duas migrations novas fazem essa parte hoje:

| Arquivo | O que faz |
|---|---|
| `supabase/migrations/20260718100000_tenancy_expand.sql` | Cria `clinics`, `clinic_memberships` e o "cofre" privado de auditoria do backfill; adiciona (de forma opcional/nullable) a coluna "de qual clínica é este registro" nas 6 tabelas clínicas existentes. |
| `supabase/migrations/20260718100100_tenancy_backfill_default_clinic.sql` | Cria a clínica "Vet do Rim" com um identificador fixo e atribui todo o acervo legado a ela, registrando cada atribuição num "manifesto" auditável. |

Uma terceira peça, o **enforcement** (a troca de verdade das regras de acesso), já está escrita
mas guardada em `supabase/migrations_staged/20260718100200_tenancy_enforce.sql.staged` —
**intencionalmente fora** do que roda hoje. Ver seção 5.

---

## 2. Como o Dr. Anderson confirma que está tudo certo: rodar o CI

Não é preciso rodar nada manualmente no computador. Todo o processo de validação já roda
sozinho dentro do GitHub Actions sempre que há um push ou Pull Request para `main`/`develop`
(ou disparando manualmente, como descrito no runbook da Fase 0,
`docs/runbooks/fase0-ci-first-run.md`, seção 6.2).

O job que interessa aqui se chama **`Database Contract`** (aparece na aba "Actions" do GitHub,
dentro da execução do workflow "CI - Vet do Rim"). Ele faz, nesta ordem:

1. Sobe um banco PostgreSQL **novo e vazio** dentro do próprio runner do GitHub (não é o banco
   de produção, não é o banco remoto — é descartável e é destruído no final).
2. Aplica **todas** as migrations da pasta `supabase/migrations/`, na ordem, contra esse banco
   vazio — incluindo as duas migrations da Fase 1 acima.
3. Roda os testes automáticos de banco (pgTAP) — é aqui que entram as verificações desta
   entrega, descritas na seção 3.
4. Roda dois "advisors" do próprio Supabase que procuram problemas de segurança e performance
   no schema resultante.

**Se o job `Database Contract` terminar verde (✓), a Fase 1 está estruturalmente correta** —
as tabelas novas existem, estão fechadas por padrão, o acervo legado foi atribuído à clínica
"Vet do Rim" e nada que já funcionava foi quebrado. Se terminar vermelho (✗), abra o log do
passo que falhou e encaminhe a mensagem de erro para o squad técnico.

---

## 3. O que cada verificação automática prova

As verificações vivem em dois arquivos `.sql` dentro de `supabase/tests/` (mesma pasta lida
automaticamente pelo comando `supabase test db --local` do passo 3 acima):

### 3.1 `production_safety_test.sql` (já existia, 17 verificações — não tocado nesta entrega)

Prova invariantes gerais de segurança de produção que já valiam antes da Fase 1: RLS ligado em
todas as tabelas clínicas, `anon` (visitante não-logado) sem nenhum acesso a dados clínicos,
funções sensíveis não vazando para papéis errados, bucket de laudos privado e limitado a PDF,
etc. Continua rodando e continua verde.

### 3.2 `tenancy_structural_test.sql` (novo nesta entrega, 16 verificações)

Cada verificação prova um pedaço específico e concreto da Fase 1. Em linguagem simples:

| # | O que prova |
|---|---|
| 1 | As três "peças novas" (tabela de clínicas, tabela de vínculo clínica↔usuário e o cofre de auditoria do backfill) realmente existem no banco. |
| 2 | As duas tabelas novas expostas (`clinics`, `clinic_memberships`) têm a proteção de linha (RLS) **ligada**. |
| 3 | Essa proteção vale até para o dono da tabela (FORCE RLS) — ninguém entra "de graça". |
| 4 | Existe exatamente a regra de leitura esperada em cada uma (só quem tem vínculo ativo com a clínica enxerga a linha). |
| 5 | Nenhuma regra de acesso nessas tabelas foi deixada "aberta para todo mundo" por engano. |
| 6 | As 6 tabelas clínicas antigas (tutores, pets, triagens, follow-ups, colaboradores, laudos) ganharam a coluna "de qual clínica é" e "quem criou" — e essa coluna é opcional por enquanto (de propósito, porque ainda não sabemos a clínica de cada linha antiga sem o backfill). |
| 7 | As 19 "amarras" que vão garantir, no futuro, que cada registro aponta para uma clínica válida e coerente com seus registros relacionados já existem, só ainda não estão em vigor forçado (isso é intencional na Fase 1). |
| 8 | A função interna que decide "este usuário tem papel X nesta clínica?" existe e foi escrita com as proteções técnicas corretas. |
| 9 | Essa função **não** pode ser chamada por visitantes anônimos nem por "todo mundo" — só por usuários autenticados. |
| 10 | Usuários autenticados **podem** chamar essa função (é assim que o sistema vai decidir permissões no futuro). |
| 11 | Visitantes anônimos não têm nenhum acesso às tabelas novas de clínica. |
| 12 | Usuários autenticados só podem **ler** as tabelas novas de clínica — não podem criar/editar/apagar clínicas ou vínculos diretamente pelo aplicativo (isso continua sendo uma operação administrativa, feita pelo servidor). |
| 13 | O "cofre" de auditoria do backfill não é acessível por ninguém do aplicativo — só quem administra o banco diretamente. |
| 14 | A clínica "Vet do Rim" foi realmente criada e está marcada como ativa, com um identificador sempre igual (o que permite conferir/repetir o processo com segurança). |
| 15 | Num banco recém-criado (sem colaboradores cadastrados ainda), o processo não inventa nenhum vínculo usuário↔clínica — isso é proposital, porque inventar um "administrador" fantasma seria perigoso. |
| 16 | Num banco recém-criado, o cofre de auditoria fica vazio — porque não havia nenhum dado legado real para registrar (é o comportamento esperado do CI, que sempre parte de um banco em branco). |

**Total desta entrega: 16 verificações novas, todas pensadas para passar de forma
determinística num banco recém-criado (sem depender de dados que só existem no ambiente
remoto real).**

---

## 4. O que essas verificações **não** provam (limitações honestas)

É importante ser direto sobre os limites do que roda automaticamente hoje:

- **Não provam que Vet A não vê dados de Vet B.** Essa prova (a "matriz negativa") existe e
  está escrita, mas depende de quatro usuários de login (Auth) reais e do enforcement já
  aplicado — coisas que **não existem** no banco vazio do CI. Ver seção 5.
- **Não provam nada sobre o acervo remoto de produção real.** O CI sempre roda contra um banco
  novo e vazio; ele prova que as *migrations*, aplicadas do zero, produzem o schema esperado —
  não audita o estado atual do banco remoto de produção (isso é um passo manual separado, já
  coberto por outro runbook de Fase 0 para auditoria remota).
- **Não testam a tela/aplicativo.** Estas são verificações de banco de dados. Testes do
  aplicativo (`npm test`, Playwright) rodam em jobs separados do CI e continuam cobrindo
  calculadoras clínicas, autenticação, etc. — não tenancy por clínica ainda, porque o app
  também só passa a filtrar por clínica na "Fase 1.5" (fora desta entrega).
- **Não testam upload real de arquivos no Storage.** As verificações inspecionam apenas o
  "catálogo de regras" do Storage (quais políticas existem, se o bucket é privado). Um teste
  de upload/download de verdade via API do Supabase é um gate separado, também reservado para
  a etapa de enforcement.

---

## 5. O passo futuro: promover o enforcement + os testes negativos (fora desta entrega)

Existe uma pasta de "candidatos aguardando promoção", com dois arquivos irmãos:

| Peça | Onde está hoje | Quando entra em vigor |
|---|---|---|
| Migration de enforcement (troca as regras de acesso pra valer, por vínculo de clínica) | `supabase/migrations_staged/20260718100200_tenancy_enforce.sql.staged` | Só depois que todos os itens do gate de promoção (`supabase/migrations_staged/README.md`) forem cumpridos. |
| Teste negativo Vet A × Vet B (prova isolamento de verdade) | `supabase/tests_staged/tenancy_negative_test.sql.staged` | Promovido **junto** com o enforcement — nunca separado (ver `supabase/tests_staged/README.md`). |

**Por que não fazer isso agora:** o enforcement é o único passo sem volta fácil do ADR-001 (a
partir dele, deixa de existir uma clínica por padrão para dados sem dono, e-mail deixa de ser
único globalmente e passa a ser único por clínica, o upload de laudo passa a exigir um fluxo
diferente do que o aplicativo usa hoje). Aplicá-lo sem antes: (a) confirmar que o app já sabe
filtrar por clínica ativa, (b) provisionar de verdade o responsável de cada clínica como
administrador, e (c) provar com usuários reais que o isolamento funciona — seria arriscado.

**Quando chegar a hora**, o processo (documentado em detalhe nos dois README acima) é:

1. Cumprir a checklist de pré-condições (app adaptado, `clinic_admin` real provisionado,
   inventário de Storage reconciliado).
2. Aplicar o enforcement **num projeto Supabase efêmero e descartável** — nunca direto em
   produção.
3. Criar os quatro usuários de teste (Vet A, Admin A, Vet B, Admin B) nesse projeto efêmero,
   usando a API de administração do Supabase (não à mão no banco).
4. Rodar o teste negativo manualmente contra esse projeto efêmero e confirmar que passa.
5. Só então promover os dois arquivos (`enforce` e o teste negativo) da pasta "staged" para as
   pastas ativas (`migrations/` e `tests/`), lado a lado, no mesmo lote.

Esse passo é do próximo agente/etapa do squad, não desta entrega.

---

## 6. Resumo executivo

| Item | Status |
|---|---|
| Estrutura de clínicas e vínculos criada | Sim (`expand`) |
| Acervo legado atribuído à clínica "Vet do Rim", com auditoria | Sim (`backfill`) |
| Regras de acesso do app já trocadas para valer por clínica | **Não, de propósito** — isso é o `enforce`, ainda em `migrations_staged/` |
| Verificações automáticas de banco cobrindo a Fase 1 | Sim — 16 novas em `supabase/tests/tenancy_structural_test.sql`, rodando no CI |
| Prova de isolamento Vet A × Vet B com usuários reais | Escrita e pronta, mas **não roda no CI** — é gate manual de promoção do `enforce` (`supabase/tests_staged/`) |
| Necessário para o Dr. Anderson hoje | Só conferir que o job "Database Contract" está verde no GitHub Actions |
