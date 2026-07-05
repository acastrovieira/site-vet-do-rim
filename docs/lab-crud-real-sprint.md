# Sprint Lab Evolution CRUD Real

## Status

Concluida com execucao real usando usuario vet temporario no Supabase.

Runbook operacional: `docs/lab-crud-real-runbook.md`.

## Correcoes aplicadas

- Adicionado teste E2E `test:e2e:lab-crud` para criar, listar e editar tutor e paciente com usuario vet temporario.
- O teste E2E de laudos valida chegada ao workflow de upload, `accept=application/pdf`, selecao de PDF e botoes de IA/troca antes do disparo da IA.
- Criadas rotas `PATCH /api/tutores/[id]` e `PATCH /api/pets/[id]`.
- O script `e2e-lab-crud-cycle.mjs` agora marca o usuario Auth como criado antes do `profiles.upsert`, evitando usuario orfao se o profile falhar.
- O script `e2e-lab-crud-cycle.mjs` agora aceita variaveis do shell ou de `web/.env.local`/`.env`, sem imprimir valores sensiveis.
- Se a limpeza de arquivos do bucket `laudos` falhar, o script preserva as linhas de `laudos_pdf` para manter os `storage_path` rastreaveis.
- Adicionado `cleanup:e2e:lab-crud` em modo dry-run por padrao para limpar residuos de execucoes interrompidas.
- O cleanup tambem aceita `E2E_CLEANUP_RUN_ID` via shell ou arquivo local de env.
- APIs `POST` e `PATCH` de tutores passaram a validar tipos, campos obrigatorios, email e UF.
- APIs `POST` e `PATCH` de pacientes passaram a validar UUID, especie, status, idade, meses e peso.
- Erros esperados passaram a retornar `400`, `403` ou `404` quando aplicavel, em vez de `500` generico.

## Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `node --check scripts/e2e-lab-crud-cycle.mjs`: passou.
- `node --check scripts/cleanup-e2e-lab-crud.mjs`: passou.
- `npm run check:predeploy`: passou apos o carregamento local de envs nos scripts.
- `npx playwright test tests/e2e/lab-crud.spec.ts` sem credenciais reais: passou como `1 skipped`, confirmando compilacao do spec sem tocar no banco.
- `npm run test:e2e:lab-crud`: passou no projeto remoto `ycclyzoslirpnnwgzrqx`.
- `npm run cleanup:e2e:lab-crud`: dry-run retornou zero residuos apos a execucao.

## Validacoes pendentes

- Nenhuma pendencia funcional aberta para esta sprint.

## Lacunas conhecidas

- Exclusao por UI/API ainda nao faz parte do fluxo CRUD funcional; atualmente a exclusao e administrativa via limpeza do script.
- Laudos nesta sprint sao validados ate a selecao de PDF e exibicao do botao de IA. Upload real, Edge Function, status de processamento e cota de IA pertencem a Sprint Upload/IA.
- Interrupcao forte do processo, como kill do terminal, ainda pode impedir limpeza final. Antes de rodar em ambiente real, garantir que o projeto alvo e staging/dev estejam corretos.
