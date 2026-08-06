import type { SupportedLocale } from './core';

export interface NoAccessTranslations {
  eyebrow: string;
  defaultTitle: string;
  defaultDescription: string;
  errors: Record<string, { title: string; description: string }>;
  loginButton: string;
  accessTitle: string;
  accessDescription: string;
}

export const noAccessTranslations: Record<SupportedLocale, NoAccessTranslations> = {
  'pt-BR': {
    eyebrow: 'Acesso negado',
    defaultTitle: 'Acesso não autorizado',
    defaultDescription: 'Sua conta Discord não tem permissão para acessar este painel.',
    errors: {
      NO_AUTHORIZED_GUILDS: {
        title: 'Acesso não autorizado',
        description:
          'Sua conta Discord não tem permissão em nenhum servidor com o Dark Bot ativo. ' +
          'Para acessar, você precisa ser dono do servidor, ter a permissão Gerenciar Servidor ' +
          'ou possuir um cargo configurado como admin do bot.',
      },
    },
    loginButton: 'Tentar com outra conta',
    accessTitle: 'Critérios de acesso',
    accessDescription: 'Dono, Gerenciar Servidor ou cargo administrativo configurado.',
  },

  'en-US': {
    eyebrow: 'Access denied',
    defaultTitle: 'Unauthorized access',
    defaultDescription: 'Your Discord account does not have permission to access this panel.',
    errors: {
      NO_AUTHORIZED_GUILDS: {
        title: 'Unauthorized access',
        description:
          'Your Discord account does not have permission on any server with Dark Bot active. ' +
          'To access, you must be the server owner, have the Manage Server permission, ' +
          'or hold a role configured as a bot admin.',
      },
    },
    loginButton: 'Try with another account',
    accessTitle: 'Access requirements',
    accessDescription: 'Server owner, Manage Server permission, or configured admin role.',
  },

  'es-ES': {
    eyebrow: 'Acceso denegado',
    defaultTitle: 'Acceso no autorizado',
    defaultDescription: 'Tu cuenta de Discord no tiene permiso para acceder a este panel.',
    errors: {
      NO_AUTHORIZED_GUILDS: {
        title: 'Acceso no autorizado',
        description:
          'Tu cuenta de Discord no tiene permiso en ningún servidor con Dark Bot activo. ' +
          'Para acceder, debes ser dueño del servidor, tener el permiso Gestionar Servidor ' +
          'o tener un rol configurado como administrador del bot.',
      },
    },
    loginButton: 'Intentar con otra cuenta',
    accessTitle: 'Criterios de acceso',
    accessDescription: 'Dueño del servidor, permiso Gestionar Servidor o rol de administrador configurado.',
  },
};
