-- QUARANTINED: legado inseguro, preservado apenas como marcador historico.
--
-- Este arquivo anteriormente removia politicas e recriava acesso global a
-- public.laudos_pdf e ao bucket privado "laudos" para todo usuario
-- authenticated. Isso viola o isolamento entre clinicas definido em
-- docs/architecture/ADR-001-tenancy-clinica-rls.md.
--
-- Nao use este arquivo para corrigir Storage/RLS. A implementacao substituta
-- deve nascer como migration revisada, ser validada em homologacao com testes
-- negativos Vet A x Vet B e receber confirmacao explicita antes de qualquer
-- aplicacao remota.

DO $quarantine$
BEGIN
  RAISE EXCEPTION
    'QUARANTINED: fix-laudos-storage.sql e inseguro e nao executa alteracoes';
END
$quarantine$;
