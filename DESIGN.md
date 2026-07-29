---
name: DTA Admin Panel
description: Central operacional da Dark Trials Arena
colors:
  background: "#0a0a14"
  surface: "#1a1a2e"
  brand-violet: "#8f32d9"
  brand-violet-light: "#d29cff"
  veto-red: "#dc143c"
  winner-gold: "#c9a227"
  success: "#2ecc71"
  warning: "#f39c12"
  error: "#e74c3c"
  text: "#ffffff"
  text-muted: "#b9bbbe"
typography:
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-violet}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  button-danger:
    backgroundColor: "{colors.veto-red}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: DTA Admin Panel

## Overview

**Creative North Star: "Mesa de Operacao Dark Trials Arena"**

Interface escura e densa para staff trabalhando durante partidas ao vivo. Identidade vem da logo, do violeta e da linguagem competitiva; estrutura permanece familiar, previsivel e rapida.

Rejeita dashboard SaaS generico com grade de cards numericos, roxo em gradientes, neon decorativo, glassmorphism e composicao promocional. Estado geral, confrontos ativos e itens que exigem atencao ocupam o primeiro viewport.

**Key Characteristics:**

- Sidebar operacional com servidor atual sempre visivel.
- Tabelas como superficie principal de comparacao.
- Paineis laterais para detalhes sem perder contexto.
- Movimento curto, apenas para comunicar estado.

## Colors

Violeta identifica selecao e progresso. Vermelho comunica veto, falha e destruicao. Dourado fica reservado para vencedor, classificacao e marcos.

**The Restraint Rule.** Cor saturada nunca domina superficies inativas. Fundo e superficies usam os neutros DTA.

**The Semantic Color Rule.** Vermelho, dourado e verde nao sao decoracao; cada um preserva significado consistente.

## Typography

Uma familia sans atende titulos, controles, tabelas e dados. IDs, placares e tempos usam numeros tabulares.

Titulos de pagina usam 20px. Titulos internos usam 16px. Corpo usa 15px. Labels usam 13px. Nao usar fonte display da logo dentro de controles.

**The Fixed Scale Rule.** Tipografia de produto usa tamanhos fixos; viewport muda estrutura, nao tamanho de fonte.

## Elevation

Sistema plano por padrao. Profundidade vem de camadas tonais e bordas de 1px. Sombras aparecem somente em menus, drawers e dialogs que realmente sobrepoem conteudo.

**The Flat-by-Default Rule.** Secoes de pagina nunca flutuam como cards decorativos.

## Components

### Buttons

Icones Lucide em comandos conhecidos. Texto acompanha somente acoes que precisam de verbo explicito. Altura minima de 40px, raio de 4px e foco violeta claro de 2px.

### Tables

Linhas entre 44px e 48px. Cabecalho fixo quando necessario, numeros tabulares, ordenacao explicita e acoes agrupadas em menu.

### Inputs

Fundo escuro, borda de 1px e raio de 4px. Erro apresenta texto objetivo; placeholder mantem contraste legivel.

### Navigation

Sidebar de 232px no desktop, reduzida a icones no tablet e substituida por navegacao inferior no mobile. Simbolo DTA, nome Dark Trials Arena e seletor de servidor ficam no topo.

### Status

Status usa texto, icone e cor. Atualizacoes em tempo real usam `aria-live="polite"`; desconexao preserva ultimo estado e marca dados como desatualizados.

## Do's and Don'ts

### Do:

- **Do** mostrar operacao ao vivo e itens que exigem atencao antes de metricas historicas.
- **Do** usar tabelas, tabs, menus e formularios padrao.
- **Do** oferecer loading, empty, error, reconnecting e sem acesso em toda tela.
- **Do** manter alvos interativos com pelo menos 40px.

### Don't:

- **Don't** criar dashboard SaaS generico com grade de cards numericos.
- **Don't** usar roxo em gradientes, neon decorativo ou glassmorphism.
- **Don't** transformar ferramenta administrativa em landing page promocional.
- **Don't** usar cards dentro de cards, gradiente em texto ou faixas laterais coloridas.
- **Don't** esconder falhas ou depender somente de cor para comunicar estado.
