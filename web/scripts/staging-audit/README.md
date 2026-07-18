# Auditoria Supabase de staging — somente leitura

Este pacote coleta evidências agregadas de catálogo, acesso e integridade sem
aplicar migrations ou alterar dados. Ele existe para os gates S0/S1 da
auditoria de produção.

## Comportamento seguro

- `npm run audit:staging` apenas valida os SQLs e imprime o plano; não abre rede.
- Cada SQL começa com `BEGIN TRANSACTION READ ONLY` e termina em `ROLLBACK`.
- Um verificador local bloqueia comandos mutantes, privilegiados e meta-comandos
  do `psql`.
- A execução remota aceita somente `SUPABASE_ENVIRONMENT=staging`.
- URL, project ref, host, usuário, porta e confirmação precisam identificar o
  mesmo projeto.
- A senha é passada por `PGPASSWORD`, nunca por argumento ou saída.
- Os SQLs retornam catálogo e contagens agregadas; não retornam nomes, e-mails,
  documentos, telefones, paths de arquivos ou conteúdo clínico.

## Variáveis para execução futura autorizada

```text
SUPABASE_PROJECT_REF=<20 caracteres>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ENVIRONMENT=staging
STAGING_AUDIT_CONFIRMATION=CONFIRM_STAGING_READ_ONLY:<project-ref>
SUPABASE_DB_HOST=db.<project-ref>.supabase.co
SUPABASE_DB_USER=postgres
SUPABASE_DB_NAME=postgres
SUPABASE_DB_PORT=5432
SUPABASE_DB_PASSWORD=<secret store>
```

Para Supavisor, o host precisa terminar em `.pooler.supabase.com`, o usuário
deve ser `postgres.<project-ref>` e a porta pode ser `5432` ou `6543`.

## Uso

Plano local, sem rede:

```bash
npm run audit:staging
```

Consulta futura, após autorização e somente em staging isolado:

```bash
npm run audit:staging -- --remote-read-only
```

Não redirecione a saída para um arquivo versionado. Se a organização exigir
evidência persistida, use armazenamento criptografado com acesso restrito,
retenção definida e revisão para PII antes do compartilhamento.

## Interpretação

1. Qualquer objeto obrigatório ausente, tabela exposta sem RLS, grant inesperado,
   grant explícito obrigatório ausente ou função `SECURITY DEFINER` executável
   por `PUBLIC` bloqueia o release. Projetos novos não devem depender dos antigos
   grants automáticos da Data API.
2. Qualquer conta privilegiada anterior ao hardening exige reconciliação humana
   individual; a contagem agregada não autoriza rebaixamento automático.
3. Qualquer laudo em estado impossível, quota fora do limite ou divergência
   entre `laudos_pdf` e Storage exige quarentena e análise antes de migration.
4. O pacote não substitui os testes negativos Vet A × Vet B, Storage API,
   `db reset`, Advisors, backup/restore ou revisão clínica.

Referências:

- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Data API com grants explícitos](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
