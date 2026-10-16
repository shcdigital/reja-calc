/** Formateo de números para la interfaz (es-AR: miles con punto, decimales con coma). */

const nf1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export const fmtNum = (n: number): string => nf1.format(n);
export const fmtMm = (n: number): string => `${nf1.format(n)} mm`;
export const fmtCm = (n: number): string => `${nf1.format(n / 10)} cm`;
export const fmtMeters = (mm: number): string => `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(mm / 1000)} m`;
export const fmtPct = (ratio: number): string => `${nf1.format(ratio * 100)} %`;
export const fmtMoney = (n: number): string => `$ ${nf2.format(n)}`;
export const fmtInt = (n: number): string => nf0.format(n);

/** Redondea a 0,1 mm (resolución de todos los largos de corte). */
export const round1 = (x: number): number => Math.round(x * 10) / 10;
