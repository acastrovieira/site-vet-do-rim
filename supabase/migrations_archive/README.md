# Migrations arquivadas — não executar

Este diretório preserva artefatos históricos para auditoria. Ele **não faz parte da cadeia ativa** em `supabase/migrations/` e nenhum arquivo daqui deve ser copiado para o SQL Editor, executado manualmente ou promovido diretamente para produção.

Os arquivos arquivados antecedem o hardening atual e contêm padrões que não são mais aceitáveis, incluindo autorização sem tenancy por clínica, referência a `auth.role()` e `CREATE POLICY IF NOT EXISTS`, sintaxe que não existe no PostgreSQL 17. As instruções antigas de “aplicar manualmente” dentro desses arquivos são apenas histórico e não constituem um runbook válido.

Fontes atuais de decisão:

- `docs/architecture/ADR-001-tenancy-clinica-rls.md` para o modelo de tenancy e RLS;
- `docs/architecture/drafts/tenancy/README.md` para os gates e testes negativos propostos;
- `docs/architecture/drafts/laudos-ia/README.md` para o contrato transacional de laudos e quota.

Uma correção futura deve nascer com `supabase migration new`, passar por revisão independente, reset em projeto efêmero, matriz negativa Vet A × Vet B, Advisors e confirmação humana explícita antes de qualquer aplicação remota. Não reutilize estes arquivos como base executável.
