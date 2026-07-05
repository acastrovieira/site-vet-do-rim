# Runbook: Sprint Mobile/UX Refinada

## Objetivo

Validar a experiencia mobile real do site Vet do Rim e do Lab Evolution, cobrindo menus, formularios longos, modais, tabelas, ferramentas publicas/profissionais e fluxo Lab autenticado.

## Entrada

- `npm run check:predeploy` passando.
- Sprint Lab CRUD real concluida para validar areas autenticadas com usuario vet temporario.
- Ambiente publicado ou servidor local acessivel no dispositivo/navegador de teste.

## Cobertura automatizada existente

O spec `web/tests/e2e/mobile-layout.spec.ts` cobre:

- rotas publicas sem overflow horizontal;
- menu mobile com links principais;
- botoes visiveis do header com nome acessivel;
- formulario longo de cadastro usavel;
- copy de ferramentas profissionais antes do login;
- redirecionamento anonimo de `/lab` para login;
- `/api/health` sem exposicao de secrets.

O spec `web/tests/e2e/lab-crud.spec.ts` tambem inclui um smoke mobile autenticado do shell do Lab:

- login com usuario vet E2E, quando credenciais estiverem configuradas;
- abertura do menu mobile autenticado;
- validacao de `aria-expanded`;
- link `Tutores` visivel;
- ausencia de overflow horizontal.

Comando:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run check:predeploy
```

## Matriz manual recomendada

Validar no minimo:

| Perfil | Viewport/dispositivo | Navegador |
| --- | --- | --- |
| Mobile pequeno | 360x740 | Chrome |
| Mobile padrao | 390x844 | Chrome/Safari |
| Tablet | 768x1024 | Chrome/Safari |
| Desktop estreito | 1024x768 | Chrome |

## Fluxos publicos

Validar visualmente:

- `/`
  - hero sem corte de texto;
  - CTAs visiveis no primeiro scroll;
  - menu abre/fecha sem deslocar layout indevidamente;
  - nenhum texto sobreposto.
- `/ferramentas`
  - cards com tags claras: `Sem cadastro`, `Freemium`, `Login vet`;
  - ferramentas profissionais nao parecem gratuitas antes do login;
  - botoes cabem na largura mobile.
- `/ferramentas/controle-de-peso`
  - inputs, selects e resultado cabem sem overflow horizontal;
  - historico/tabelas continuam legiveis.
- `/ferramentas/planilha-laboratorial`
  - criacao de paciente local;
  - modal/formulario de exame;
  - tabela laboratorial com rolagem horizontal controlada;
  - graficos visiveis sem cortar legenda.
- `/auth/login`
  - campos acessiveis;
  - link de recuperacao visivel;
  - erro de credencial nao quebra layout.
- `/auth/cadastro`
  - todos os campos acessiveis;
  - toggle de senha funciona;
  - mensagem de erro/sucesso cabe no card.

## Fluxos Lab autenticados

Usar usuario vet temporario da Sprint Lab CRUD real.

Validar:

- `/lab`
  - topbar mobile visivel;
  - menu lateral mobile abre/fecha;
  - navegacao para Pacientes, Tutores e Perfil.
- `/lab/tutores`
  - tabela/lista com rolagem horizontal quando necessario;
  - botao de novo tutor visivel;
  - estado vazio e estado com dados temporarios legiveis.
- `/lab/tutores/novo`
  - formulario inteiro acessivel no mobile;
  - campos obrigatorios nao ficam escondidos sob teclado;
  - erro de validacao visivel.
- `/lab/pacientes`
  - tabela/lista sem corte de acoes;
  - botao de novo paciente visivel.
- `/lab/pacientes/novo`
  - selects e campos numericos usaveis;
  - validacao visivel.
- `/lab/pacientes/[petId]/laudos`
  - dropzone de PDF visivel;
  - rejeicao de nao-PDF legivel;
  - botoes `Analisar com IA` e `Trocar` cabem no mobile;
  - painel de acao/resultado aparece antes do preview do PDF no mobile;
  - preview do PDF usa altura relativa ao viewport e nao empurra a acao principal para fora do fluxo.
- `/lab/tutores/[id]`
  - modais de obito/exclusao centralizados;
  - foco visual claro;
  - conteudo longo rola dentro do modal sem travar a pagina;
  - acoes de confirmar/cancelar permanecem acessiveis em telas pequenas.

## Criterios de rejeicao

Abrir issue/correcao se houver:

- overflow horizontal inesperado no documento inteiro;
- botao primario cortado ou inacessivel;
- formulario sem caminho claro de envio/cancelamento;
- modal sem fechamento visivel;
- texto clinico/legal truncado;
- elemento fixo cobrindo campo ativo;
- erro tecnico exposto ao usuario final;
- copy que sugira acesso gratuito a ferramenta protegida por login vet.

## Evidencia esperada

Guardar no fechamento da sprint:

- comando `npm run check:predeploy` com sucesso;
- resultado esperado local atual: 7 testes mobile aprovados; testes Lab/Upload remotos podem ficar skipped sem credenciais E2E;
- screenshots mobile de:
  - home com menu aberto;
  - ferramentas;
  - cadastro;
  - Lab dashboard autenticado;
  - formulario de tutor ou paciente;
  - laudos/upload;
  - modal de tutor/paciente, se aplicavel.

## Criterio de saida

A Sprint Mobile/UX refinada so fica concluida quando:

- testes automatizados mobile passam;
- QA manual cobre a matriz minima;
- problemas P0/P1 corrigidos;
- problemas menores documentados para sprint posterior.
