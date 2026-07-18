# Governanca da documentacao

**Estado de release vigente (2026-07-17): NO-GO para dados e pacientes reais.**

A fonte atual de decisao e o [relatorio integral de readiness](auditoria-production-readiness-2026-07-16.md). Nenhum checklist, dashboard ou registro historico anterior pode substituir esse veredito.

## Documentos normativos atuais

- [Auditoria e plano de remediacao](auditoria-production-readiness-2026-07-16.md): decisao, evidencias, riscos e sprints.
- [Story de auditoria](stories/AUDIT-001.production-readiness-audit.md): rastreabilidade do trabalho e findings.
- [ADR de tenancy/RLS](architecture/ADR-001-tenancy-clinica-rls.md): arquitetura proposta; nao autoriza migration remota.
- [Draft de tenancy](architecture/drafts/tenancy/README.md): SQL em quarentena para revisao e ambiente efemero.
- [Draft transacional de laudos/IA](architecture/drafts/laudos-ia/README.md): contrato em quarentena para revisao.
- [Plano de revalidacao clinica](clinical/clinical-engine-revalidation-plan.md): gates humanos e tecnicos antes de reativar motores.
- [Auditoria AIOX e configuracao raiz](aiox-root-config-audit-2026-07-16.md): limita o papel do framework vendorizado e registra drift de versao, paths, agentes, IDEs e documentos.

## Evidencia historica, nao autorizacao operacional

Os demais runbooks, planos de sprint, dashboards e relatorios registram o estado observado quando foram escritos. Marcacoes como "passou" ou "concluido" nesses arquivos nao comprovam o estado atual, nao aprovam producao e nao autorizam `db push`, deploy, exclusao ou teste com dados reais.

## Gate obrigatorio para operacoes remotas

1. usar somente homologacao isolada e dados sinteticos;
2. declarar `SUPABASE_PROJECT_REF` e URL coincidente, sem fallback;
3. declarar `SUPABASE_ENVIRONMENT=staging`;
4. confirmar o alvo com `SUPABASE_MUTATION_CONFIRMATION=CONFIRM_STAGING_MUTATION:<project-ref>`;
5. revisar dry-run/diff e obter confirmacao humana explicita antes de migration, deploy ou exclusao;
6. preservar manifesto de dados temporarios, evidencias e limpeza verificavel.

Producao permanece bloqueada ate todos os criterios de GO do relatorio integral serem comprovados.
