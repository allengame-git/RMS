/**
 * @file date-utils.ts
 * @description 日期格式化工具模組
 *
 * 此模組提供一致的日期格式化函式，確保 SSR 與 Client Hydration 的一致性。
 *
 * ## 核心功能
 * - `formatDate`：格式化為 `YYYY/MM/DD`
 * - `formatDateTime`：格式化為 `YYYY/MM/DD HH:mm`
 *
 * ## 為什麼需要這個模組？
 * Next.js 的 SSR 和 Client Hydration 可能因時區差異導致日期顯示不一致，
 * 使用統一的格式化函式可避免 hydration mismatch 錯誤。
 *
 * ## 使用範例
 * ```tsx
 * import { formatDate, formatDateTime } from '@/lib/date-utils';
 *
 * <span>{formatDate(item.createdAt)}</span>
 * <span>{formatDateTime(item.createdAt)}</span>
 * ```
 *
 * @see /src/components - 各元件使用此模組格式化日期
 */

/**
 * Formats a date to YYYY/MM/DD consistently for SSR and Client Hydration.
 */
export function formatDate(date: Date | string | number): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const Y = d.getFullYear();
    const M = d.getMonth() + 1;
    const D = d.getDate();

    return `${Y}/${M}/${D}`;
}

/**
 * Formats a date to YYYY/MM/DD HH:mm consistently.
 */
export function formatDateTime(date: Date | string | number): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const Y = d.getFullYear();
    const M = d.getMonth() + 1;
    const D = d.getDate();
    const H = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");

    return `${Y}/${M}/${D} ${H}:${m}`;
}
