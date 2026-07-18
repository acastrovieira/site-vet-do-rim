# Auditoria do AIOX e da configuracao raiz

**Data:** 2026-07-16  
**Escopo:** `.aiox-core/`, `AGENTS.md`, `package.json`, lockfiles e documentacao
operacional na raiz.  
**Decisao:** o AIOX vendorizado **nao esta homologado como pacote publicavel nem
como gate do produto**. Essa decisao nao muda, por si so, o comportamento do
aplicativo em `web/`.

## Resumo executivo

A copia local contem 1.147 arquivos nao ignorados do AIOX e carrega metadados de diferentes
geracoes do framework. O entrypoint CommonJS pode ser carregado depois da
instalacao das dependencias, mas build, testes, lint, tipos, manifestos, agentes,
IDE sync e documentacao nao formam uma cadeia de release coerente.

Por seguranca, nao foram inventados arquivos ausentes, movidos templates ou
executados sincronizadores com escrita. O pacote vendorizado foi marcado como
`private`, os gates da raiz passaram a delegar explicitamente para o produto em
`web/` e os desvios restantes foram registrados abaixo.

## Correcoes seguras aplicadas

| Correcao | Resultado |
|---|---|
| Pacote e scripts da raiz | O pacote recebeu nome estavel, `private: true`, lock coerente e scripts `build`, `lint`, `typecheck`, `test` e `check:predeploy` que delegam para `web/`. |
| Mapa e comandos de `AGENTS.md` | Adaptados ao repositorio brownfield: runtime em `web/`, backend em `supabase/` e testes em `web/tests/`. Comandos AIOX nao homologados deixaram de ser apresentados como gates. |
| `.aiox-core/package.json` | Recebeu `private: true`, bloqueando publicacao acidental desta copia incoerente. |
| Runbooks operacionais | Treze caminhos absolutos do computador do autor foram substituidos por resolucao portavel via `git rev-parse --show-toplevel`. |
| Estados de sprint | Mobile/UX, Lab CRUD e Upload/IA receberam banners que preservam a evidencia historica sem contradizer o NO-GO vigente. |
| Matriz de autoridade | `docs/architecture/command-authority-matrix.md` foi criada a partir da constituicao versionada; as 12 referencias PM/PO/SM agora resolvem sem ampliar permissao de push, deploy ou migration remota. |

## Achados comprovados no AIOX

### AIOX-01 — identidade de versao contraditoria (P1)

- `version.json`, `install-manifest.yaml` e `.installed-manifest.yaml` declaram
  `5.2.4`;
- `package.json` e `package-lock.json` declaram `4.31.1`;
- os peers declaram `^4.31.0`;
- `core-config.yaml` declara `project.version: 2.1.0`;
- `user-guide.md` se identifica como guia `v2.0`, atualizado em janeiro de 2025;
- `scripts/update-aiox.sh` se identifica como `v5.2`.

Nao e seguro escolher um desses numeros e reescrever os demais sem conhecer o
contrato da distribuicao upstream. A publicacao permanece bloqueada.

### AIOX-02 — superficie de pacote incompleta (P1)

O `package.json` anuncia artefatos inexistentes nesta copia:

- `index.d.ts` e `bin/aiox-core.js`;
- diretorios publicaveis `lib/`, `templates/`, `utils/` e `tasks/`;
- `README.md` e `LICENSE` na raiz do pacote;
- build em `../tools/build-core.js`;
- testes em `tests/unit` e `tests/integration`;
- configuracao TypeScript, Jest e ESLint correspondente.

Com dependencias instaladas, `npm run build`, `npm test`, `npm run lint` e
`npm run typecheck` terminaram com codigo 1. O build nao encontra o arquivo; os
outros tres nao encontram, respectivamente, Jest, ESLint e TypeScript. O
entrypoint `index.js`, isoladamente, carregou e exportou seis modulos.

### AIOX-03 — configuracao aponta para recursos ausentes (P1)

Uma verificacao mecanica de 35 caminhos relevantes de `core-config.yaml`
encontrou 19 ausentes. Entre eles:

- `docs/prd.md`, `docs/architecture.md` e os tres arquivos de
  `docs/framework/` carregados obrigatoriamente;
- `.aiox-core/tools`, `templates/squad`, `.claude/mcp.json` e
  `.docker/mcp/gateway-service.yml`;
- `.aiox/project-status.yaml`, `outputs/minds/pedro_valerio`,
  `docs/stories/backlog`, `docs/architecture/project-decisions` e `squads/`;
- o target Gemini `.gemini/rules/AIOX/agents`.

Alguns caminhos podem ser opcionais ou gerados sob demanda, mas a configuracao
nao os distingue. Portanto, ausencia nao pode ser interpretada como feature
validada.

### AIOX-04 — agentes e IDEs apresentam drift (P1)

O validador de agentes retornou codigo 0, mas registrou **121 warnings** de
dependencias ausentes ou tipo desconhecido para 12 agentes. Esse comportamento
e insuficiente como quality gate porque aceita dependencias nao resolvidas.

O validador estrito de IDE sync falhou com:

- 109 artefatos esperados;
- 75 sincronizados;
- 25 ausentes;
- 9 divergentes;
- 12 orfaos.

Nenhum sync foi executado, pois ele escreveria dezenas de artefatos gerados e
exige uma decisao de escopo sobre quais IDEs devem ser mantidas.

### AIOX-05 — YAMLs e links documentais invalidos (P2)

Foram verificados 124 arquivos JSON/YAML:

- 31 JSONs validos;
- 54 YAMLs validos;
- 36 templates com sintaxe de pre-processamento, excluidos do parse YAML puro;
- 3 templates `.yaml` que falham no parser direto:
  `activation-instructions-inline-greeting.yaml`,
  `personalized-workflow-template.yaml` e
  `personalized-template-file.yaml`.

Em 93 documentos operacionais AIOX, 38 links locais apontam para arquivos
ausentes. A busca ampla encontrou 91 ocorrencias, mas parte delas e placeholder
intencional de template ou texto dentro de exemplos de codigo. Os 24 documentos
atuais do produto nao possuem links locais quebrados.

### AIOX-06 — instalacao e supply chain (P2)

`npm ci --ignore-scripts` em `.aiox-core` instalou 127 pacotes e
`npm audit --omit=dev` nao encontrou vulnerabilidades conhecidas. O npm, porem,
emitiu aviso de deprecacao para `glob@10.5.0`. Ausencia de advisory nao comprova
manutencao ou compatibilidade do framework.

## Privacidade e portabilidade

Nao restaram caminhos `C:\Users\...` nos runbooks do produto. O unico caminho
de usuario em `.aiox-core` e um exemplo generico `/Users/username/...`.

Uma busca estatica por formatos comuns de chaves privadas, tokens AWS/OpenAI,
tokens Supabase e JWTs nao encontrou credencial convincente nos arquivos
versionados desse escopo. Os emails encontrados sao exemplos ou dados E2E sob o
dominio reservado `.example.test`.

O nome completo do responsavel pela marca aparece em
`docs/manual-marca-vet-do-rim.md`. Ele parece ser conteudo institucional
intencional, nao um vazamento tecnico, e por isso nao foi removido. Sua
publicacao deve ser confirmada pelo titular antes do GO.

## Decisoes necessarias

1. **Escolher o papel do AIOX:** dependencia operacional do projeto ou snapshot
   historico. Se for operacional, reinstalar uma distribuicao oficial completa
   e de versao unica em branch dedicada. Se for historico, mante-lo privado e
   fora dos gates de produto.
2. **Definir IDEs suportadas:** somente depois disso executar sync com dry-run,
   revisar o diff e eliminar ausentes, drift e orfaos.
3. **Definir politica de documentos upstream:** restaurar as 38 referencias
   operacionais ou retirar os links obsoletos em uma atualizacao controlada do
   bundle, sem misturar com o release do aplicativo.
4. **Confirmar publicacao do nome institucional:** registrar consentimento e
   finalidade antes de publicar o manual de marca.

## Validacao apos as correcoes

| Verificacao | Resultado |
|---|---|
| `npm run lint` na raiz | PASS; delegacao para `web` comprovada. |
| `npm run typecheck` na raiz | PASS; delegacao para `web` comprovada. |
| `npm test` na raiz | PASS; 58/58 testes de contrato/unitários no gate final. |
| `npm audit --omit=dev` na raiz e em `.aiox-core` | PASS; zero vulnerabilidades conhecidas. |
| `npm ci --ignore-scripts` em `.aiox-core` | PASS; 127 pacotes instalados. |
| Parse de `package.json`/lockfiles e verificacao do diff | PASS. |
| Links locais nos 24 documentos do produto | PASS; zero quebrados. |
| Busca de paths absolutos nos runbooks | PASS; zero paths da estacao de trabalho. |

O build completo do produto pertence ao gate integrado geral e nao foi usado
para inferir que o AIOX compila. Os quatro scripts de build/qualidade internos
do AIOX continuam reprovados conforme AIOX-02.

## Gate recomendado

O AIOX so pode ser chamado de homologado quando houver, para uma unica versao:

- manifestos e pacote coerentes;
- todos os paths/exportacoes declarados presentes;
- build, lint, tipos e testes executaveis e verdes;
- zero dependencia de agente ausente;
- IDE sync estrito sem missing, drift ou orphan;
- JSON/YAML validos conforme o pipeline real de templates;
- links operacionais resolvidos;
- instalacao limpa e audit reexecutados.

Enquanto isso, o gate autoritativo do produto e `npm run check:predeploy` na
raiz, que delega para `web/`. Ele nao certifica o framework AIOX.
