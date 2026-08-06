/**
 * i18n core — infraestrutura compartilhada por todas as telas.
 *
 * Padrão de uso:
 *   1. Crie panel/src/lib/i18n/<feature>.ts com o objeto de traduções tipado.
 *   2. Use `useLocale()` no componente para obter o locale ativo.
 *   3. Indexe o objeto: `const t = translations[locale]`.
 *
 * Para adicionar um novo idioma: inclua a chave em SupportedLocale,
 * adicione a entrada em LOCALE_MAP e preencha todos os arquivos de feature.
 */

export type SupportedLocale = 'pt-BR' | 'en-US' | 'es-ES';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['pt-BR', 'en-US', 'es-ES'];

const STORAGE_KEY = 'dta:locale';

/**
 * Mapeamento de tags BCP-47 para os três locales suportados.
 * Inclui apenas os prefixos necessários para detecção automática pelo browser.
 */
const LOCALE_MAP: Record<string, SupportedLocale> = {
  'pt':    'pt-BR',
  'pt-BR': 'pt-BR',
  'en':    'en-US',
  'en-US': 'en-US',
  'es':    'es-ES',
  'es-ES': 'es-ES',
};

/**
 * Detecta o locale a usar, em ordem de prioridade:
 *   1. Preferência salva pelo usuário no localStorage.
 *   2. Lista de idiomas preferidos do browser (navigator.languages).
 *   3. Fallback para 'en-US'.
 */
export function detectLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch {
    // localStorage pode estar indisponível em perfis de browser restritos.
  }

  for (const lang of navigator.languages ?? [navigator.language]) {
    const exact = LOCALE_MAP[lang];
    if (exact) return exact;
    const prefix = LOCALE_MAP[lang.split('-')[0]!];
    if (prefix) return prefix;
  }

  return 'en-US';
}

/** Persiste a escolha manual do usuário. */
export function persistLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Silencioso — a seleção ainda funciona para a sessão atual.
  }
}
