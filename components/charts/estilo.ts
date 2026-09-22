/** Constantes compartilhadas pelos gráficos (Recharts recebe número/cor, não classe do Tailwind). */

export const NAVY = "#2D3278";
export const ORANGE = "#F47B20";
export const GAIN = "#1B8A6B";
export const GRADE = "#E4E5EC";
export const EIXO = "#D9DBE4";

/** Paleta do gráfico de alocação, na ordem em que as fatias aparecem. */
export const CORES_CATEGORIA = [NAVY, ORANGE, "#7A80C4", GAIN];

/** Regra de design: nenhum texto abaixo de 18 px, inclusive dentro dos gráficos. */
export const FONTE = 18;

/** Espaço mínimo entre rótulos do eixo X: a 18 px o Recharts omite os que não couberem. */
export const ESPACO_ROTULO = 16;

/** Largura do eixo Y — comporta "US$ 2,1 mi" a 18 px sem cortar. */
export const LARGURA_EIXO_Y = 92;

/**
 * Margem do gráfico. O `right` existe para o último rótulo do eixo X: ele é centrado
 * no último ponto e, a 18 px, "dez/26" ficava cortado na borda direita no celular.
 */
export const MARGEM = { top: 8, right: 34, left: 8, bottom: 0 } as const;

export const ESTILO_TOOLTIP = { fontSize: FONTE } as const;
export const ESTILO_LEGENDA = { fontSize: FONTE, paddingTop: 8 } as const;
export const TICK = { fontSize: FONTE } as const;
