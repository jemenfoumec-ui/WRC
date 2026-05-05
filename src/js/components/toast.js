// ==========================================
// SYSTÈME DE NOTIFICATIONS TOAST - CORRIGÉ
// WRC 2026 - Version 2.1
// ==========================================

/**
 * Affiche une notification toast moderne
 * Usage: showToast('Message') ou showToast('Message', 'success') ou showToast('Title', 'Message', 'success')
 */
window.showToast = function(arg1, arg2 = '', arg3 = 'info', duration = 5000) {
    // Déterminer les arguments
    let title, message, type;
    
    if (['success', 'error', 'warning', 'info'].includes(arg2)) {
        // Format: showToast('Message', 'type')
        title = arg1;
        message = '';
        type = arg2;
    } else if (['success', 'error', 'warning', 'info'].includes(arg3)) {
        // Format: showToast('Title', 'Message', 'type')
        title = arg1;
        message = arg2;
        type = arg3;
    } else {
        // Format: showToast('Message')
        title = arg1;
        message = arg2;
        type = 'info';
    }
    
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Fermer">✕</button>
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);
    toast.offsetHeight;
    toast.style.opacity = '1';

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
};

// ==========================================
// API SIMPLIFIÉE
// ==========================================
window.toast = {
    success: (title, message = '', duration = 5000) => {
        return window.showToast(title, message, 'success', duration);
    },

    error: (title, message = '', duration = 6000) => {
        return window.showToast(title, message, 'error', duration);
    },

    warning: (title, message = '', duration = 5000) => {
        return window.showToast(title, message, 'warning', duration);
    },

    info: (title, message = '', duration = 5000) => {
        return window.showToast(title, message, 'info', duration);
    },

    confirm: (title, message, onConfirm, onCancel) => {
        const container = document.getElementById('toastContainer') || (() => {
            const c = document.createElement('div');
            c.id = 'toastContainer';
            c.className = 'toast-container';
            document.body.appendChild(c);
            return c;
        })();

        const toast = document.createElement('div');
        toast.className = 'toast warning toast-confirm';
        toast.setAttribute('role', 'alertdialog');
        
        toast.innerHTML = `
            <div class="toast-icon">⚠</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
                <div class="toast-actions">
                    <button class="toast-btn toast-btn-confirm">Confirmer</button>
                    <button class="toast-btn toast-btn-cancel">Annuler</button>
                </div>
            </div>
        `;

        container.appendChild(toast);
        toast.offsetHeight;
        toast.style.opacity = '1';

        const removeToast = () => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-btn-confirm').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            removeToast();
        });

        toast.querySelector('.toast-btn-cancel').addEventListener('click', () => {
            if (onCancel) onCancel();
            removeToast();
        });

        return toast;
    }
};

// ==========================================
// COMPATIBILITÉ
// ==========================================
window.showError = function(message, title = 'Erreur') {
    return toast.error(title, message);
};

window.showSuccess = function(message, title = 'Succès') {
    return toast.success(title, message);
};

window.showInfo = function(message, title = 'Information') {
    return toast.info(title, message);
};

window.showWarning = function(message, title = 'Attention') {
    return toast.warning(title, message);
};

// ==========================================
// MESSAGES WRC
// ==========================================
window.wrcToast = {
    voteSuccess: () => toast.success('Vote enregistré !', 'Votre soutien a été pris en compte'),
    voteError: () => toast.error('Vote impossible', 'Vous avez déjà voté pour cette track'),
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
// STYLES CSS
// ==========================================
if (!document.getElementById('toast-styles')) {
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

        .toast[style*="opacity: 1"] {
            opacity: 1;
            transform: translateX(0);
        }

        .toast.removing {
            opacity: 0;
            transform: translateX(100%);
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

console.log('✅ Toast System v2.0 ready');
