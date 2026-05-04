/**
 * WRC 2026 - Auth Module Index
 * Barrel export for auth modules
 */

export { 
    openAuthModal, 
    closeAuthModal, 
    logout, 
    loadUser, 
    saveUser, 
    getUser, 
    getAuthState,
    checkPageAccess,
    initAuth,
    wrcAuth 
} from './auth.js';

export { showToast, toast } from './toast.js';

export default {
    auth: {
        openModal: openAuthModal,
        closeModal: closeAuthModal,
        logout,
        getUser,
        isAuthenticated: () => wrcAuth.isAuthenticated
    },
    toast
};