# Studio de Comandos Dinâmicos

## Escopo

O Studio cria comandos slash por servidor e permite sobrescrever comandos nativos sem modificar `src/commands`. Toda definição possui PT-BR e English, rascunho mutável e versões publicadas imutáveis.

## Ciclo de vida

| Estado | Registro no Discord | Comportamento |
| --- | --- | --- |
| `factory` | Sim | Payload e handler do código. |
| `draft` nativo | Payload de fábrica | Alterações ainda privadas no painel. |
| `draft` personalizado | Não | Ainda não existe no Discord. |
| `published` | Sim | Versão publicada e ID Discord persistido. |
| desativado | Não, para comandos dinâmicos | O catálogo do servidor é recomposto sem o comando. |
| `factory_restored` | Payload de fábrica | Sobrescrita nativa arquivada. |
| `archived` | Não | Comando personalizado removido do catálogo ativo. |

Publicação e rollback usam o endpoint de comandos do servidor. Comandos de guild aparecem imediatamente e evitam duplicidade com comandos globais, que continuam limpos no startup.

## Definição

`CustomCommandDefinition` inclui:

- nomes e descrições `ptBR`/`enUS`;
- parâmetros, escolhas, subcomandos e grupos;
- permissões administrativas, cargos, usuários e cooldown;
- mensagens, embeds, botões, selects e modais;
- condições, sorteio ponderado, delay, cargos, variáveis e scripts;
- modo `native`, que adapta nomes públicos ao handler de fábrica, ou `workflow`.

Limites do Discord são validados antes de persistir e antes de compilar. O catálogo aceita no máximo 100 comandos e recusa nomes duplicados.

## Sandbox

Scripts executam com `quickjs-emscripten` em runtime descartável:

- memória: 8 MB;
- pilha: 512 KB;
- CPU: 200 ms por execução;
- sem `process`, `require`, `fetch`, `WebSocket`, `Function` ou `eval`;
- contexto congelado sem variáveis de ambiente;
- saída convertida novamente para workflows e validada por Zod.

A SDK expõe apenas `discord.reply`, `followup`, `sendMessage`, `addRole`, `removeRole`, `setVariable` e `console.log`. Acesso a scripts exige dono, `Manage Guild`, cargo ou usuário configurado em **Acesso a scripts**.

## Interações e reinício

Botões, selects e modais usam tokens aleatórios persistidos em `CustomCommandInteraction`. O registro guarda servidor, versão, nó, contexto mínimo, usuário permitido e expiração. Isso mantém interações válidas após reinício sem colocar dados sensíveis no `custom_id`.

## Auditoria

Salvar, publicar, rollback, clone, ativação, execução e interação geram eventos por servidor. Código de script e definição completa não entram nos detalhes da auditoria. A interface resolve o membro atual e mostra o apelido; o snowflake permanece apenas no tooltip.

## Operação

1. Execute `npm run db:deploy` antes de iniciar a versão nova.
2. Confirme `CustomCommand`, `CustomCommandVersion` e `CustomCommandInteraction` no banco.
3. Publique primeiro em servidor de teste.
4. Verifique nome localizado, parâmetros, permissões, resposta e componentes.
5. Em falha de sincronização, corrija o rascunho e publique novamente; comandos de fábrica permanecem recuperáveis.
