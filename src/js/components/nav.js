/**
 * WRC 2026 - Navigation Component (ESM)
 */

import { getIcon } from '../utils/icons.js';
import { protectedPages, storageKeys, logger } from '../core/config.js';

const CONFIG = {
    sidebarWidth: {
        collapsed: 72,
        expanded: 260
    },
    transitionDuration: 300,
    breakpoint: 1024
};

const NAV_ITEMS = {
    main: [
        { id: 'home', label: 'Accueil', href: 'index.html', icon: 'home' },
        { id: 'arena', label: 'Arène', href: 'tournament-arena.html', icon: 'trophy', badge: { text: 'LIVE', type: 'live' } },
        { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'grid' },
        { id: 'register', label: "S'inscrire", href: 'tournament-registration.html', icon: 'user-plus' }
    ],
    content: [
        { id: 'protocol', label: 'Protocole', href: 'protocol.html', icon: 'file-text' },
        { id: 'faq', label: 'FAQ', href: 'faq.html', icon: 'help-circle' }
    ],
    admin: [
        { id: 'admin', label: 'Admin Panel', href: 'dashboard-admin.html', icon: 'settings', roles: ['admin'] },
        { id: 'jury', label: 'Jury Panel', href: 'dashboard-jury.html', icon: 'users', roles: ['admin', 'jury'] }
    ]
};

export class WRCNavigation {
    constructor() {
        this.isOpen = false;
        this.currentPage = this.detectCurrentPage();
        this.user = this.getUser();
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.build());
        } else {
            this.build();
        }
    }

    build() {
        this.createSidebar();
        this.createMobileElements();
        this.wrapContent();
        this.bindEvents();
        this.updateUserDisplay();
    }

    createSidebar() {
        const sidebar = document.createElement('aside');
        sidebar.className = 'wrc-sidebar';
        sidebar.id = 'wrcSidebar';
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="sidebar-logo">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <span class="sidebar-logo-text">WRC 2026</span>
            </div>
            
            <nav class="sidebar-nav">
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Menu</span>
                    ${this.renderNavItems(NAV_ITEMS.main)}
                </div>
                
                <div class="sidebar-divider"></div>
                
                <div class="sidebar-section">
                    <span class="sidebar-section-title">Contenu</span>
                    ${this.renderNavItems(NAV_ITEMS.content)}
                </div>
                
                <div class="sidebar-section sidebar-admin" id="sidebarAdmin" style="display:none;">
                    <div class="sidebar-divider"></div>
                    <span class="sidebar-section-title">Administration</span>
                    ${this.renderNavItems(NAV_ITEMS.admin)}
                </div>
            </nav>
            
            <div class="sidebar-footer">
                <div class="sidebar-user" id="sidebarUser">
                    <div class="sidebar-avatar" id="sidebarAvatar">👤</div>
                    <div class="sidebar-user-details">
                        <div class="sidebar-user-name" id="sidebarUserName">Connexion</div>
                        <div class="sidebar-user-role" id="sidebarUserRole">Non connecté</div>
                    </div>
                </div>
                <button class="sidebar-logout-btn" id="sidebarLogout" style="display:none;">
                    <span>🚪</span>
                    <span class="sidebar-logout-text">Déconnexion</span>
                </button>
            </div>
        `;
        
        const appContainer = document.querySelector('.wrc-app') || document.body;
        appContainer.insertBefore(sidebar, appContainer.firstChild);
        this.sidebar = sidebar;
    }

    renderNavItems(items) {
        return items.map(item => {
            const isActive = this.isActivePage(item.href);
            const badge = item.badge 
                ? `<span class="sidebar-badge ${item.badge.type || ''}">${item.badge.text}</span>` 
                : '';
            
            return `
                <a href="${item.href}" class="sidebar-item ${isActive ? 'active' : ''}" data-page="${item.id}">
                    <span class="sidebar-icon">${getIcon(item.icon)}</span>
                    <span class="sidebar-label">${item.label}</span>
                    ${badge}
                </a>
            `;
        }).join('');
    }

    createMobileElements() {
        const overlay = document.createElement('div');
        overlay.className = 'wrc-overlay';
        overlay.id = 'wrcOverlay';
        document.body.appendChild(overlay);
        this.overlay = overlay;
        
        const toggle = document.createElement('button');
        toggle.className = 'wrc-mobile-toggle';
        toggle.id = 'wrcMobileToggle';
        toggle.setAttribute('aria-label', 'Menu');
        toggle.innerHTML = getIcon('menu');
        document.body.appendChild(toggle);
        this.toggle = toggle;
        
        const header = document.createElement('header');
        header.className = 'wrc-mobile-header';
        header.innerHTML = `<span class="wrc-mobile-header-title">WRC 2026</span>`;
        document.body.appendChild(header);
        this.mobileHeader = header;
    }

    wrapContent() {
        if (document.querySelector('.wrc-main')) return;
        const main = document.querySelector('main, .main-container, #main-content');
        if (!main) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'wrc-main';
        wrapper.id = 'wrcMain';
        main.parentNode.insertBefore(wrapper, main);
        wrapper.appendChild(main);
    }

    bindEvents() {
        this.toggle.addEventListener('click', () => this.toggleSidebar());
        this.overlay.addEventListener('click', () => this.closeSidebar());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.closeSidebar();
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth >= CONFIG.breakpoint && this.isOpen) this.closeSidebar();
        });
        
        this.sidebar.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (window.innerWidth < CONFIG.breakpoint) this.closeSidebar();
                
                const href = item.getAttribute('href');
                if (href && href !== '#') {
                    const isProtected = protectedPages.some(p => href.includes(p));
                    const isLoggedIn = !!this.user;
                    
                    if (isProtected && !isLoggedIn) {
                        e.preventDefault();
                        if (window.openAuth) window.openAuth('fan');
                    }
                }
            });
        });
        
        document.getElementById('sidebarUser')?.addEventListener('click', () => this.handleUserClick());
        document.getElementById('sidebarLogout')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) window.logout();
        });
        
        window.addEventListener('wrc-auth-change', (e) => {
            this.user = e.detail?.user || null;
            this.updateUserDisplay();
        });
    }

    toggleSidebar() {
        this.isOpen ? this.closeSidebar() : this.openSidebar();
    }

    openSidebar() {
        this.isOpen = true;
        this.sidebar.classList.add('open');
        this.overlay.classList.add('visible');
        this.toggle.innerHTML = getIcon('x');
        document.body.style.overflow = 'hidden';
    }

    closeSidebar() {
        this.isOpen = false;
        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('visible');
        this.toggle.innerHTML = getIcon('menu');
        document.body.style.overflow = '';
    }

    getUser() {
        try {
            const data = localStorage.getItem(storageKeys.user) || sessionStorage.getItem(storageKeys.user);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    updateUserDisplay() {
        const avatarEl = document.getElementById('sidebarAvatar');
        const nameEl = document.getElementById('sidebarUserName');
        const roleEl = document.getElementById('sidebarUserRole');
        const adminSection = document.getElementById('sidebarAdmin');
        const logoutBtn = document.getElementById('sidebarLogout');
        
        if (this.user) {
            const name = this.user.username || this.user.email?.split('@')[0] || 'User';
            const roleLabels = { admin: 'Administrateur', jury: 'Membre du Jury', artist: 'Artiste', fan: 'Fan' };
            
            if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
            if (nameEl) nameEl.textContent = name;
            if (roleEl) roleEl.textContent = roleLabels[this.user.role] || 'Membre';
            if (adminSection) adminSection.style.display = (this.user.role === 'admin' || this.user.role === 'jury') ? 'block' : 'none';
            if (logoutBtn) logoutBtn.style.display = 'flex';
        } else {
            if (avatarEl) avatarEl.textContent = '👤';
            if (nameEl) nameEl.textContent = 'Connexion';
            if (roleEl) roleEl.textContent = 'Non connecté';
            if (adminSection) adminSection.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    handleUserClick() {
        if (this.user) {
            window.location.href = 'profile-edit.html';
        } else if (window.openAuth) {
            window.openAuth('fan');
        }
    }

    detectCurrentPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    isActivePage(href) {
        return href === this.currentPage || (this.currentPage === 'index.html' && href === 'index.html');
    }
}

// Auto-initialize
export const navigation = new WRCNavigation();
window.wrcNav = navigation;
