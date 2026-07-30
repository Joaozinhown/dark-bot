import { Building2, ChevronDown } from 'lucide-react';
import { useGuildContext } from '../context/guild-context';

export function GuildSelector() {
  const { guilds, selectedGuildId, selectGuild, isPending } = useGuildContext();

  return (
    <label className="guild-selector">
      <span className="guild-selector__label">Servidor</span>
      <span className="guild-selector__control">
        <Building2 aria-hidden="true" />
        <select
          aria-label="Servidor atual"
          value={selectedGuildId}
          onChange={event => selectGuild(event.target.value)}
          disabled={isPending || guilds.length === 0}
        >
          {isPending ? <option>Carregando...</option> : null}
          {!isPending && guilds.length === 0 ? <option>Nenhum servidor</option> : null}
          {guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}
