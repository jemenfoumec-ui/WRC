/**
 * WRC 2026 - Toast Notification System (ESM)
 * Modern notification system with accessibility support
 */

// ==========================================
// TOAST ICONS
// ==========================================
const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
};

// ==========================================
// ESCAPE HTML
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// SHOW TOAST
// ==========================================
export function showToast(title, typeOrMessage = 'info', maybeMessage = null, duration = 5000) {
    // Determine argument format
    let titleText, messageText, type;
    
    if (['success', 'error', 'warning', 'info'].includes(typeOrMessage)) {
        // Format: showToast('Title', 'type')
        titleText = title;
        messageText = '';
        type = typeOrMessage;
    } else if (maybeMessage && ['success', 'error', 'warning', 'info'].includes(maybeMessage)) {
        // Format: showToast('Title', 'Message', 'type')
        titleText = title;
        messageText = typeOrMessage;
        type = maybeMessage;
    } else {
        // Format: showToast('Title') or showToast('Title', 'message')
        titleText = title;
        messageText = typeOrMessage || '';
        type = 'info';
    }

    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(titleText)}</div>
            ${messageText ? `<div class="toast-message">${escapeHtml(messageText)}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Fermer">✕</button>
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    const removeToast = () => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast();
    });

    toast.addEventListener('click', removeToast);

    if (duration > 0) {
        setTimeout(removeToast, duration);
    }

    return toast;
}

// ==========================================
// TOAST API
// ==========================================
export const toast = {
    success: (title, message = '', duration = 5000) => {
        return showToast(title, message, 'success', duration);
    },

    error: (title, message = '', duration = 6000) => {
        return showToast(title, message, 'error', duration);
    },

    warning: (title, message = '', duration = 5000) => {
        return showToast(title, message, 'warning', duration);
    },

    info: (title, message = '', duration = 5000) => {
        return showToast(title, message, 'info', duration);
    },

    confirm: (title, message, onConfirm, onCancel) => {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toastEl = document.createElement('div');
        toastEl.className = 'toast warning toast-confirm';
        toastEl.setAttribute('role', 'alertdialog');
        
        toastEl.innerHTML = `
            <div class="toast-icon">⚠</div>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(title)}</div>
                ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
                <div class="toast-actions">
                    <button class="toast-btn toast-btn-confirm">Confirmer</button>
                    <button class="toast-btn toast-btn-cancel">Annuler</button>
                </div>
            </div>
        `;

        container.appendChild(toastEl);
        requestAnimationFrame(() => {
            toastEl.style.opacity = '1';
            toastEl.style.transform = 'translateX(0)';
        });

        const removeToast = () => {
            toastEl.classList.add('removing');
            setTimeout(() => toastEl.remove(), 300);
        };

        toastEl.querySelector('.toast-btn-confirm').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            removeToast();
        });

        toastEl.querySelector('.toast-btn-cancel').addEventListener('click', () => {
            if (onCancel) onCancel();
            removeToast();
        });

        return toastEl;
    }
};

// ==========================================
// LEGACY COMPATIBILITY
// ==========================================
window.showToast = showToast;
window.toast = toast;

window.showError = (message, title = 'Erreur') => toast.error(title, message);
window.showSuccess = (message, title = 'Succès') => toast.success(title, message);
window.showInfo = (message, title = 'Information') => toast.info(title, message);
window.showWarning = (message, title = 'Attention') => toast.warning(title, message);

// ==========================================
// WRC PRESET MESSAGES
// ==========================================
window.wrcToast = {
    voteSuccess: () => toast.success('Vote enregistré !', 'Votre soutien a été pris en compte'),
    voteError: () => toast.error('Vote impossible', 'Vous avez déjà voted pour cette track'),
    votePending: () => toast.info('Vote en cours...', 'Veuillez patienter'),
    uploadSuccess: () => toast.success('Track uploadée !', 'Votre morceau est maintenant en ligne'),
    uploadError: (msg) => toast.error('Upload échoué', msg || 'Erreur lors de l\'envoi'),
    loginSuccess: () => toast.success('Connexion réussie', 'Bienvenue sur le WRC'),
    loginError: () => toast.error('Connexion impossible', 'Identifiants incorrects'),
    signupSuccess: () => toast.success('Inscription réussie', 'Vérifiez vos emails pour confirmer'),
    logoutSuccess: () => toast.info('Déconnexion', 'À bientôt !'),
    deleteSuccess: () => toast.success('Track supprimée', 'Le fichier a été retiré'),
    syncSuccess: () => toast.success('Synchronisation OK', 'Les votes ont été mis à jour'),
    loginRequired: () => toast.warning('Connexion requise', 'Créez un compte pour continuer'),
    accessDenied: () => toast.error('Accès refusé', 'Permissions insuffisantes'),
    networkError: () => toast.error('Erreur réseau', 'Vérifiez votre connexion'),
    serverError: () => toast.error('Erreur serveur', 'Réessayez plus tard'),
    matchStarting: () => toast.info('Match imminent !', 'Le match va commencer'),
    matchEnded: () => toast.success('Match terminé', 'Résultats disponibles'),
    custom: (title, message, type = 'info') => toast[type](title, message)
};

// ==========================================
// INJECT STYLES
// ==========================================
function injectStyles() {
    if (document.getElementById('toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        .toast-container {
            position: fixed;
            top: calc(var(--header-height, 60px) + 16px);
            right: 16px;
            z-index: var(--z-toast, 10000);
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: min(400px, calc(100vw - 32px));
            pointer-events: none;
        }

        .toast {
            background: rgba(15, 15, 20, 0.98);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            gap: 12px;
            align-items: flex-start;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            pointer-events: auto;
        }

        .toast.success { border-left: 4px solid #4ade80; }
        .toast.error { border-left: 4px solid #ef4444; }
        .toast.warning { border-left: 4px solid #f59e0b; }
        .toast.info { border-left: 4px solid #7b2cbf; }

        .toast-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
        }

        .toast.success .toast-icon { background: #4ade80; color: #000; }
        .toast.error .toast-icon { background: #ef4444; color: #fff; }
        .toast.warning .toast-icon { background: #f59e0b; color: #000; }
        .toast.info .toast-icon { background: #7b2cbf; color: #fff; }

        .toast-content { flex: 1; min-width: 0; }
        .toast-title { font-weight: 600; color: #fff; margin-bottom: 4px; font-size: 0.95rem; }
        .toast-message { font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); line-height: 1.4; }

        .toast-close {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            padding: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s;
            flex-shrink: 0;
            font-size: 12px;
        }

        .toast-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .toast-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #7b2cbf, #9d4edd);
            animation: toastProgress linear forwards;
            border-radius: 0 0 0 12px;
        }

        @keyframes toastProgress {
            from { width: 100%; }
            to { width: 0%; }
        }

        .toast-confirm { max-width: 350px; }

        .toast-actions {
            display: flex;
            gap: 10px;
            margin-top: 12px;
        }

        .toast-btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .toast-btn-confirm {
            background: #4ade80;
            color: #000;
        }

        .toast-btn-confirm:hover {
            background: #22c55e;
            transform: translateY(-1px);
        }

        .toast-btn-cancel {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .toast-btn-cancel:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 640px) {
            .toast-container {
                right: 12px;
                left: 12px;
                max-width: none;
            }

            .toast { padding: 14px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .toast {
                transition: opacity 0.2s;
                transform: none !important;
            }
            .toast-progress { animation: none; }
        }
    `;
    document.head.appendChild(style);
}

// Auto-inject styles
injectStyles();