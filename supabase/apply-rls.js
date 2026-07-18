/**
 * QUARANTINED: legado inseguro, preservado apenas como marcador historico.
 *
 * A versao anterior aceitava uma chave service-role pela linha de comando e
 * tentava recriar politicas globais para tutores e pets. Isso permitiria
 * acesso horizontal entre usuarios autenticados e tambem exporia o segredo
 * no historico de comandos do terminal.
 *
 * Use migrations revisadas, homologacao isolada e confirmacao explicita para
 * qualquer alteracao remota. Consulte:
 * docs/architecture/ADR-001-tenancy-clinica-rls.md
 */

console.error(
  'QUARANTINED: supabase/apply-rls.js e inseguro e nao executa alteracoes.',
)
process.exitCode = 1
