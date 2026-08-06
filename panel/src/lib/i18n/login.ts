import type { SupportedLocale } from './core';

export interface LoginTranslations {
  eyebrow: string;
  title: string;
  description: string;
  loginButton: string;
  accessTitle: string;
  accessDescription: string;
  checkingBot: string;
  botOnline: string;
  botStarting: string;
  serversConnected: (count: number) => string;
}

export const loginTranslations: Record<SupportedLocale, LoginTranslations> = {
  'pt-BR': {
    eyebrow: 'Central operacional',
    title: 'Acesse com sua conta do Discord',
    description: 'Somente servidores conectados ao Dark Bot e autorizados para sua conta serão exibidos.',
    loginButton: 'Entrar com Discord',
    accessTitle: 'Acesso restrito à staff',
    accessDescription: 'Dono, Gerenciar Servidor ou cargo administrativo configurado.',
    checkingBot: 'Verificando o bot',
    botOnline: 'Dark Bot online',
    botStarting: 'Dark Bot iniciando',
    serversConnected: count => `${count} ${count === 1 ? 'servidor conectado' : 'servidores conectados'}`,
  },

  'en-US': {
    eyebrow: 'Operations center',
    title: 'Sign in with your Discord account',
    description: 'Only servers connected to Dark Bot and authorized for your account will be shown.',
    loginButton: 'Sign in with Discord',
    accessTitle: 'Staff access only',
    accessDescription: 'Server owner, Manage Server permission, or configured admin role.',
    checkingBot: 'Checking bot status',
    botOnline: 'Dark Bot online',
    botStarting: 'Dark Bot starting',
    serversConnected: count => `${count} ${count === 1 ? 'server connected' : 'servers connected'}`,
  },

  'es-ES': {
    eyebrow: 'Central operacional',
    title: 'Accede con tu cuenta de Discord',
    description: 'Solo se mostrarán los servidores conectados al Dark Bot y autorizados para tu cuenta.',
    loginButton: 'Entrar con Discord',
    accessTitle: 'Acceso restringido al staff',
    accessDescription: 'Dueño del servidor, permiso Gestionar Servidor o rol de administrador configurado.',
    checkingBot: 'Verificando el bot',
    botOnline: 'Dark Bot en línea',
    botStarting: 'Dark Bot iniciando',
    serversConnected: count => `${count} ${count === 1 ? 'servidor conectado' : 'servidores conectados'}`,
  },
};
