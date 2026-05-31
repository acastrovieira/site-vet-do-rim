/**
 * Ponto de entrada do middleware do Next.js.
 * Delega para o proxy de autenticação Supabase em proxy.ts.
 *
 * O Next.js só reconhece o arquivo `middleware.ts` na raiz de `src/`.
 * NUNCA coloque lógica diretamente aqui — mantenha em proxy.ts.
 */
export { proxy as middleware, config } from './proxy'
