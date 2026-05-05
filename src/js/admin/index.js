/**
 * WRC 2026 - Admin Module Index
 * Barrel export for admin modules
 */

export { AdminApi, adminApi } from './AdminApi.js';
export { AdminUI, adminUI } from './AdminUI.js';
export { AdminStats, adminStats } from './AdminStats.js';

export default {
    api: AdminApi,
    ui: AdminUI,
    stats: AdminStats
};