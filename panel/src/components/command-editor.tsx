import { Braces, FlaskConical, Plus, RotateCcw, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  Command,
  CustomCommandDefinition,
  Guild,
  LocalizedText,
  ManagementData,
  PanelAction,
  WorkflowStep,
} from '../types/api';

interface CommandEditorProps {
  command: Command | null;
  guilds: Guild[];
  management: ManagementData | undefined;
  isPending: boolean;
  run: (action: PanelAction) => Promise<unknown>;
  onSaved: (message: string) => void;
  onClose: () => void;
}

type EditorTab = 'visual' | 'json';

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function localized(ptBR = '', enUS = ''): LocalizedText {
  return { ptBR, enUS };
}

function emptyMessage(content = 'Nova resposta') {
  return { content: localized(content, content), ephemeral: false, embeds: [], components: [] };
}

function blankDefinition(): CustomCommandDefinition {
  return {
    schemaVersion: 1,
    execution: { mode: 'workflow' },
    command: {
      name: localized('novo-comando', 'new-command'),
      description: localized('Descrição do comando', 'Command description'),
      options: [],
      defaultMemberPermissions: null,
      nsfw: false,
    },
    permissions: { requireBotAdmin: false, allowedRoleIds: [], allowedUserIds: [], cooldownSeconds: 0 },
    workflow: [{ id: id('reply'), type: 'reply', message: emptyMessage('Resposta do comando') }],
  };
}

function defaultStep(type: WorkflowStep['type']): WorkflowStep {
  if (type === 'reply' || type === 'followup') return { id: id(type), type, message: emptyMessage() };
  if (type === 'send_message') return { id: id(type), type, channelId: '{{channel.id}}', message: emptyMessage() };
  if (type === 'add_role' || type === 'remove_role') return { id: id(type), type, userId: '{{user.id}}', roleId: '' };
  if (type === 'set_variable') return { id: id(type), type, name: 'resultado', value: '{{option.valor}}' };
  if (type === 'condition') return {
    id: id(type), type, left: '{{option.valor}}', operator: 'equals', right: 'sim',
    whenTrue: [{ id: id('reply'), type: 'reply', message: emptyMessage('Condição atendida') }],
    whenFalse: [{ id: id('reply'), type: 'reply', message: emptyMessage('Condição não atendida') }],
  };
  if (type === 'random') return {
    id: id(type), type, branches: [
      { id: id('branch'), weight: 1, workflow: [{ id: id('reply'), type: 'reply', message: emptyMessage('Opção A') }] },
      { id: id('branch'), weight: 1, workflow: [{ id: id('reply'), type: 'reply', message: emptyMessage('Opção B') }] },
    ],
  };
  if (type === 'delay') return { id: id(type), type, milliseconds: 1_000 };
  return { id: id(type), type: 'script', code: "discord.reply({ content: { ptBR: 'Olá', enUS: 'Hello' }, ephemeral: true, embeds: [], components: [] });" };
}

function readDefinition(text: string): CustomCommandDefinition {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON deve conter um objeto de comando.');
  return parsed as CustomCommandDefinition;
}

function roleIds(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean))];
}

function MessageFields({ step, onChange }: { step: Extract<WorkflowStep, { type: 'reply' | 'followup' | 'send_message' }>; onChange: (step: WorkflowStep) => void }) {
  const message = step.message;
  return <div className="command-step__fields">
    {'channelId' in step ? <label className="form-field">Canal ou template<input value={step.channelId} onChange={event => onChange({ ...step, channelId: event.target.value })} /></label> : null}
    <div className="form-grid">
      <label className="form-field">Texto PT-BR<textarea value={message.content?.ptBR ?? ''} onChange={event => onChange({ ...step, message: { ...message, content: { ptBR: event.target.value, enUS: message.content?.enUS ?? '' } } })} /></label>
      <label className="form-field">Texto English<textarea value={message.content?.enUS ?? ''} onChange={event => onChange({ ...step, message: { ...message, content: { ptBR: message.content?.ptBR ?? '', enUS: event.target.value } } })} /></label>
    </div>
    <label className="switch-control"><input type="checkbox" checked={message.ephemeral} onChange={event => onChange({ ...step, message: { ...message, ephemeral: event.target.checked } })} /><span>Resposta visível somente para quem executou</span></label>
  </div>;
}

export function CommandEditor({ command, guilds, management, isPending, run, onSaved, onClose }: CommandEditorProps) {
  const initial = command?.definition ?? blankDefinition();
  const [definition, setDefinition] = useState<CustomCommandDefinition>(initial);
  const [tab, setTab] = useState<EditorTab>('visual');
  const [jsonText, setJsonText] = useState(JSON.stringify(initial, null, 2));
  const [localError, setLocalError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<string | null>(null);
  const [cloneGuildId, setCloneGuildId] = useState('');

  useEffect(() => {
    const next = command?.definition ?? blankDefinition();
    setDefinition(next);
    setJsonText(JSON.stringify(next, null, 2));
    setLocalError(null);
    setSimulation(null);
  }, [command]);

  function update(next: CustomCommandDefinition) {
    setDefinition(next);
    setJsonText(JSON.stringify(next, null, 2));
    setLocalError(null);
  }

  function currentDefinition(): CustomCommandDefinition {
    if (tab === 'json') return readDefinition(jsonText);
    return definition;
  }

  function applyJson() {
    try {
      update(readDefinition(jsonText));
      setTab('visual');
    } catch (error: unknown) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  async function save(shouldPublish: boolean) {
    setLocalError(null);
    try {
      const next = currentDefinition();
      const saved = await run({
        type: 'command.save-draft',
        commandId: command?.id ?? null,
        sourceType: command?.sourceType ?? 'custom',
        factoryCommandName: command?.factoryCommandName ?? null,
        definition: next,
      }) as Command;
      if (shouldPublish) {
        if (saved.id === null) throw new Error('Comando salvo sem identificador.');
        await run({ type: 'command.publish', commandId: saved.id });
      }
      onSaved(shouldPublish ? `/${next.command.name.ptBR} publicado no Discord.` : `Rascunho de /${next.command.name.ptBR} salvo.`);
      onClose();
    } catch (error: unknown) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  async function simulate() {
    setLocalError(null);
    try {
      const result = await run({ type: 'command.preview', definition: currentDefinition(), simulation: { locale: 'pt-BR', options: {} } });
      setSimulation(JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  function addParameter() {
    update({ ...definition, command: { ...definition.command, options: [...definition.command.options, {
      kind: 'parameter', id: id('option'), key: `opcao${definition.command.options.length + 1}`, type: 'string',
      name: localized(`opcao${definition.command.options.length + 1}`, `option${definition.command.options.length + 1}`),
      description: localized('Valor da opção', 'Option value'), required: false,
    }] } });
  }

  function addStep(type: WorkflowStep['type']) {
    update({ ...definition, workflow: [...definition.workflow, defaultStep(type)] });
  }

  function updateOption(index: number, option: CustomCommandDefinition['command']['options'][number]) {
    update({ ...definition, command: { ...definition.command, options: definition.command.options.map((item, itemIndex) => itemIndex === index ? option : item) } });
  }

  function updateStep(index: number, step: WorkflowStep) {
    update({ ...definition, workflow: definition.workflow.map((item, itemIndex) => itemIndex === index ? step : item) });
  }

  function addComponent(kind: 'button' | 'select' | 'modal') {
    const firstMessageIndex = definition.workflow.findIndex(step => 'message' in step);
    if (firstMessageIndex < 0) {
      setLocalError('Adicione uma etapa de resposta antes do componente.');
      return;
    }
    const step = definition.workflow[firstMessageIndex] as Extract<WorkflowStep, { type: 'reply' | 'followup' | 'send_message' }>;
    const workflow = [{ id: id('reply'), type: 'reply' as const, message: emptyMessage('Interação recebida') }];
    const component = kind === 'button'
      ? { kind, id: id('button'), label: localized('Confirmar', 'Confirm'), style: 'primary' as const, expiresInSeconds: 900, restrictToInvoker: true, workflow }
      : kind === 'select'
        ? { kind, id: id('select'), placeholder: localized('Selecione', 'Select'), minValues: 1, maxValues: 1, expiresInSeconds: 900, restrictToInvoker: true, options: [{ id: id('choice'), label: localized('Opção A', 'Option A'), value: 'a' }], workflow }
        : { kind, id: id('modal'), label: localized('Abrir formulário', 'Open form'), style: 'secondary' as const, title: localized('Formulário', 'Form'), expiresInSeconds: 900, restrictToInvoker: true, fields: [{ id: 'resposta', label: localized('Resposta', 'Answer'), style: 'short' as const, required: true }], workflow };
    updateStep(firstMessageIndex, { ...step, message: { ...step.message, components: [...step.message.components, component] } });
  }

  return <div className="command-editor">
    <div className="segmented-control" role="tablist" aria-label="Modo do editor">
      <button type="button" className={tab === 'visual' ? 'is-active' : ''} onClick={() => setTab('visual')}>Editor visual</button>
      <button type="button" className={tab === 'json' ? 'is-active' : ''} onClick={() => setTab('json')}><Braces aria-hidden="true" />JSON avançado</button>
    </div>
    {localError ? <p className="mutation-feedback mutation-feedback--error" role="alert">{localError}</p> : null}

    {tab === 'json' ? <section className="command-editor__json">
      <label className="form-field">Definição completa<textarea spellCheck={false} value={jsonText} onChange={event => setJsonText(event.target.value)} /></label>
      <div className="form-actions"><button className="button button--secondary" type="button" onClick={applyJson}>Aplicar no editor visual</button></div>
    </section> : <div className="command-editor__visual">
      <section className="form-section">
        <h3>Identidade e localização</h3>
        <div className="form-grid">
          <label className="form-field">Nome PT-BR<input maxLength={32} value={definition.command.name.ptBR} onChange={event => update({ ...definition, command: { ...definition.command, name: { ...definition.command.name, ptBR: event.target.value } } })} /></label>
          <label className="form-field">Name English<input maxLength={32} value={definition.command.name.enUS} onChange={event => update({ ...definition, command: { ...definition.command, name: { ...definition.command.name, enUS: event.target.value } } })} /></label>
          <label className="form-field">Descrição PT-BR<input maxLength={100} value={definition.command.description.ptBR} onChange={event => update({ ...definition, command: { ...definition.command, description: { ...definition.command.description, ptBR: event.target.value } } })} /></label>
          <label className="form-field">Description English<input maxLength={100} value={definition.command.description.enUS} onChange={event => update({ ...definition, command: { ...definition.command, description: { ...definition.command.description, enUS: event.target.value } } })} /></label>
        </div>
        {command?.sourceType === 'native' ? <label className="form-field">Execução<select value={definition.execution.mode} onChange={event => update({ ...definition, execution: event.target.value === 'native' ? { mode: 'native', factoryCommandName: command.factoryCommandName ?? undefined } : { mode: 'workflow' } })}><option value="native">Handler nativo do bot</option><option value="workflow">Fluxo personalizado</option></select></label> : null}
      </section>

      <section className="form-section">
        <div className="section-inline"><div><h3>Parâmetros</h3><p className="form-help">Tipos, nomes e descrições enviados ao Discord.</p></div><button className="button button--secondary" type="button" onClick={addParameter}><Plus aria-hidden="true" />Parâmetro</button></div>
        <div className="command-options">{definition.command.options.map((option, index) => <div className="command-option" key={option.id}>
          {option.kind === 'parameter' ? <div className="command-option__editor">
            <div className="form-grid"><label className="form-field">Chave interna<input value={option.key} onChange={event => updateOption(index, { ...option, key: event.target.value })} /></label><label className="form-field">Tipo<select value={option.type} onChange={event => updateOption(index, { ...option, type: event.target.value as typeof option.type })}><option value="string">Texto</option><option value="integer">Inteiro</option><option value="number">Número</option><option value="boolean">Sim/não</option><option value="user">Usuário</option><option value="channel">Canal</option><option value="role">Cargo</option><option value="mentionable">Mencionável</option><option value="attachment">Anexo</option></select></label><label className="form-field">Nome PT-BR<input value={option.name.ptBR} onChange={event => updateOption(index, { ...option, name: { ...option.name, ptBR: event.target.value } })} /></label><label className="form-field">Name English<input value={option.name.enUS} onChange={event => updateOption(index, { ...option, name: { ...option.name, enUS: event.target.value } })} /></label><label className="form-field">Descrição PT-BR<input value={option.description.ptBR} onChange={event => updateOption(index, { ...option, description: { ...option.description, ptBR: event.target.value } })} /></label><label className="form-field">Description English<input value={option.description.enUS} onChange={event => updateOption(index, { ...option, description: { ...option.description, enUS: event.target.value } })} /></label></div><label className="switch-control"><input type="checkbox" checked={option.required} onChange={event => updateOption(index, { ...option, required: event.target.checked })} /><span>Obrigatório</span></label>
          </div> : <div><strong>{option.kind}</strong><span>/{option.name.ptBR}</span></div>}
          <button className="icon-button" type="button" aria-label="Remover parâmetro" onClick={() => update({ ...definition, command: { ...definition.command, options: definition.command.options.filter((_, itemIndex) => itemIndex !== index) } })}><Trash2 aria-hidden="true" /></button>
        </div>)}</div>
        {definition.command.options.some(option => option.kind !== 'parameter') ? <p className="form-help">Grupos, escolhas, limites e subcomandos permanecem editáveis no JSON avançado.</p> : null}
      </section>

      <section className="form-section">
        <h3>Permissões</h3>
        <label className="switch-control"><input type="checkbox" checked={definition.permissions.requireBotAdmin} onChange={event => update({ ...definition, permissions: { ...definition.permissions, requireBotAdmin: event.target.checked } })} /><span>Exigir administrador do bot</span></label>
        <div className="form-grid">
          <label className="form-field">Cargos permitidos<select multiple value={definition.permissions.allowedRoleIds} onChange={event => update({ ...definition, permissions: { ...definition.permissions, allowedRoleIds: [...event.target.selectedOptions].map(option => option.value) } })}>{management?.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="form-field">IDs de usuários<textarea value={definition.permissions.allowedUserIds.join('\n')} onChange={event => update({ ...definition, permissions: { ...definition.permissions, allowedUserIds: roleIds(event.target.value) } })} /></label>
          <label className="form-field">Cooldown em segundos<input type="number" min={0} max={86400} value={definition.permissions.cooldownSeconds} onChange={event => update({ ...definition, permissions: { ...definition.permissions, cooldownSeconds: Number(event.target.value) } })} /></label>
        </div>
      </section>

      {definition.execution.mode === 'workflow' ? <section className="form-section">
        <div className="section-inline"><div><h3>Fluxo funcional</h3><p className="form-help">Executado na ordem. Templates: {'{{user.id}}'}, {'{{option.nome}}'}, {'{{guild.name}}'}.</p></div></div>
        <div className="workflow-toolbar">
          {(['reply', 'followup', 'send_message', 'add_role', 'remove_role', 'condition', 'random', 'delay', 'script'] as const).map(type => <button type="button" className="button button--secondary" key={type} onClick={() => addStep(type)}><Plus aria-hidden="true" />{type}</button>)}
        </div>
        <div className="command-workflow">{definition.workflow.map((step, index) => <article className="command-step" key={step.id}>
          <header><strong>{index + 1}. {step.type}</strong><button className="icon-button" type="button" aria-label="Remover etapa" onClick={() => update({ ...definition, workflow: definition.workflow.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 aria-hidden="true" /></button></header>
          {'message' in step ? <MessageFields step={step} onChange={next => updateStep(index, next)} /> : step.type === 'script' ? <label className="form-field">JavaScript isolado<textarea className="code-input" spellCheck={false} value={step.code} onChange={event => updateStep(index, { ...step, code: event.target.value })} /></label> : <p className="form-help">Configuração completa disponível no JSON avançado.</p>}
        </article>)}</div>
        <div className="workflow-toolbar"><span className="form-help">Adicionar à primeira resposta:</span><button className="button button--secondary" type="button" onClick={() => addComponent('button')}>Botão</button><button className="button button--secondary" type="button" onClick={() => addComponent('select')}>Seleção</button><button className="button button--secondary" type="button" onClick={() => addComponent('modal')}>Modal</button></div>
      </section> : null}

      {command?.id ? <section className="form-section"><h3>Versões e clonagem</h3>
        <div className="command-versions">{command.versions.map(version => <button className="button button--secondary" type="button" disabled={isPending} key={version.id} onClick={() => void run({ type: 'command.rollback', commandId: command.id!, versionId: version.id }).then(() => onSaved(`Versão ${version.version} restaurada e publicada.`))}><RotateCcw aria-hidden="true" />v{version.version}</button>)}</div>
        <div className="form-grid"><label className="form-field">Servidor de destino<select value={cloneGuildId} onChange={event => setCloneGuildId(event.target.value)}><option value="">Selecione</option>{guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label><div className="form-actions"><button className="button button--secondary" type="button" disabled={!cloneGuildId || isPending} onClick={() => void run({ type: 'command.clone', commandId: command.id!, targetGuildId: cloneGuildId, name: definition.command.name }).then(() => onSaved('Rascunho clonado no servidor de destino.'))}>Clonar rascunho</button></div></div>
      </section> : null}
    </div>}

    {simulation ? <section className="simulation-output"><strong>Resultado da simulação</strong><pre>{simulation}</pre></section> : null}
    <footer className="command-editor__actions">
      <button className="button button--secondary" type="button" onClick={() => void simulate()} disabled={isPending}><FlaskConical aria-hidden="true" />Simular</button>
      <span />
      <button className="button button--secondary" type="button" onClick={() => void save(false)} disabled={isPending}><Save aria-hidden="true" />Salvar rascunho</button>
      <button className="button button--primary" type="button" onClick={() => void save(true)} disabled={isPending}><Send aria-hidden="true" />Salvar e publicar</button>
    </footer>
  </div>;
}
