# Sprint 3 — runbook de release, privacidade, backup e rollback

**Estado:** evidência local somente. Este documento não atesta backup, restore, LGPD ou produção como concluídos.

## Limites e logs

- As rotas clínicas de reserva de upload, extração local e exportação consomem uma RPC transacional no Postgres, limitada por usuário autenticado e escopo fixo, e retornam `429` com `Retry-After`.
- A Edge Function de análise ainda aplica uma defesa adicional por instância antes de iniciar processamento externo; ela não substitui o contador distribuído das rotas Next nem um limite de gateway/WAF.
- A RPC não recebe IDs clínicos, IP, nomes, paths, arquivos ou conteúdo; deriva somente `auth.uid()`, armazena uma contagem efêmera por escopo e remove janelas ociosas após cinco minutos. Falha do limitador bloqueia upload e extração (`503`); exportação, por ser leitura autorizada, continua disponível com `X-RateLimit-Policy: degraded-read-only`.
- **Ação humana obrigatória antes de produção:** configurar e testar um rate limit distribuído no gateway/WAF (por identidade autenticada e, complementarmente, IP), com os mesmos ou menores limites. Registrar apenas contagens agregadas e códigos de evento.

## Checklist de LGPD e observabilidade

- [ ] DPO/Jurídico aprovou bases legais, retenção, subprocessadores e canal de direitos do titular.
- [ ] Responsável técnico verificou que logs de plataforma, Edge Function e APM não capturam corpo HTTP, `Authorization`, cookies, nomes, e-mails, IDs de pacientes/tutores, paths de Storage, PDF ou resultado clínico.
- [ ] Alertas usam somente eventos allowlisted (por exemplo `event=processing_failed`) e códigos técnicos; não incluem payload ou mensagens brutas de provedores.
- [ ] Foi exercitado opt-out de analytics em staging e a evidência de rede foi anexada ao ticket de release.
- [ ] Retenção e acesso aos PDFs foram comprovados no ambiente alvo. O descarte automático está suspenso: preservar sob retenção controlada até política aprovada por DPO/Jurídico; não alegar exclusão enquanto não houver evidência verificável.

## Backup e restore: execução humana controlada

1. Abrir ticket de mudança, registrar ambiente, operador, início em ISO 8601 e objetivo do teste.
2. Executar o procedimento oficial do provedor para backup de banco e Storage no **ambiente de staging isolado**. Salvar identificador, escopo, timestamp e checksum/manifesto fornecidos pelo provedor.
3. Não marque backup como aprovado se o provedor não devolver evidência verificável. “Comando iniciado” não é prova de backup.
4. Restaurar em ambiente novo, isolado e sem tráfego real; jamais sobrescrever produção durante o teste.
5. Validar: contagem de tabelas críticas, amostra autorizada sem expor dados em log, políticas/RLS, integridade de migrations e acesso autorizado/negado entre clínicas.
6. Registrar duração real, tamanho, falhas e lacunas. Comparar com RPO/RTO formalmente aprovados; se não existirem, o gate permanece **NO-GO**.
7. Anexar evidências ao ticket e obter aprovação de Segurança/Privacidade, responsável de banco e responsável clínico antes de qualquer release.

### Ensaio local descartável — 2026-08-23

Foi executado um ensaio sem rede remota em uma stack Supabase local isolada:

- replay limpo das 21 migrations;
- inserção de uma clínica marcadora exclusivamente sintética;
- dump `public` somente de dados, com 3.786 bytes e SHA-256
  `B49D04366C4F345F8F24E645D371D0FB217E44AF047CE138800A9D66507FDCB5`;
- novo reset, comprovando ausência da linha antes do restore;
- restore em destino explicitamente limpo, recuperando a linha sintética;
- nova execução dos contratos de banco: 99/99 pgTAP aprovados;
- alteração transacional seguida de `ROLLBACK`, comprovando que o marcador
  restaurado permaneceu inalterado.

O primeiro restore deliberadamente tentou uma base já semeada e falhou, como
deveria, por colisão da chave da clínica padrão. Portanto, o procedimento de
staging deve usar um destino novo/isolado ou um plano de reconciliação aprovado;
nunca sobrepor cegamente um dump de dados a uma base que já contém seed.

Este ensaio prova o mecanismo local e o runbook, mas **não** prova backup
gerenciado, binários do Storage, RPO/RTO, restauração remota ou permissões do
provedor. Esses controles continuam obrigatórios em staging.

## Rollback de aplicação e banco

1. Definir gatilho objetivo (erro sustentado, regressão de autorização, vazamento de dados, indisponibilidade) e responsável por decidir.
2. Para aplicação: reverter para o artefato previamente aprovado pelo mecanismo oficial de deploy; registrar versão anterior/nova e horário. Não usar este runbook para disparar deploy.
3. Para migrations: não executar `down` ad hoc. Avaliar migration corretiva forward-only, compatível com os dados existentes, revisada por DBA e testada no restore isolado.
4. Após rollback, executar smoke tests de autenticação, isolamento entre
   clínicas, upload, extração, exportação e preservação/acesso autorizado ao
   original; manter logs sem PII/dados clínicos. Não reativar descarte sem a
   política aprovada.
5. Declarar incidente, preservar evidências mínimas e comunicar titulares/autoridades somente conforme avaliação jurídica/DPO.

## Evidências mínimas do gate

| Controle | Evidência exigida | Situação local |
| --- | --- | --- |
| Limite de rota | pgTAP/contrato + `429`/`Retry-After` no staging | RPC e isolamento aprovados localmente; staging pendente |
| Logs minimizados | Revisão de código + inspeção de logs do ambiente | Código revisado; ambiente pendente |
| Backup | Identificador, manifesto/checksum e operador | Ensaio local com checksum aprovado; provedor/staging pendente |
| Restore | Ambiente isolado, resultado e duração | Restore local e 99/99 pgTAP aprovados; provedor/staging pendente |
| Rollback | Exercício documentado em staging | Rollback transacional local aprovado; release em staging pendente |
| LGPD | Aprovação DPO/Jurídico e evidência de configuração | Pendente humana |
