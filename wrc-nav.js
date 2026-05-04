/**
 * WRC 2026 - Navigation System
 * Modern App Shell with Sidebar Navigation
 * @version 4.0
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════
    
    const CONFIG = {
        sidebarWidth: {
            collapsed: 72,
            expanded: 260
        },
        transitionDuration: 300,
        breakpoint: 1024
    };

    // ═══════════════════════════════════════════
    // NAV ITEMS DEFINITION
    // ═══════════════════════════════════════════
    
    const NAV_ITEMS = {
        main: [
            {
                id: 'home',
                label: 'Accueil',
                href: 'index.html',
                icon: 'home'
            },
            {
                id: 'arena',
                label: 'Arène',
                href: 'tournament-arena.html',
                icon: 'trophy',
                badge: { text: 'LIVE', type: 'live' }
            },
            {
                id: 'dashboard',
                label: 'Dashboard',
                href: 'dashboard.html',
                icon: 'grid'
            },
            {
                id: 'register',
                label: "S'inscrire",
                href: 'tournament-registration.html',
                icon: 'user-plus'
            }
        ],
        content: [
            {
                id: 'protocol',
                label: 'Protocole',
                href: 'protocol.html',
                icon: 'file-text'
            },
            {
                id: 'faq',
                label: 'FAQ',
                href: 'faq.html',
                icon: 'help-circle'
            }
        ],
        admin: [
            {
                id: 'admin',
                label: 'Admin Panel',
                href: 'dashboard-admin.html',
                icon: 'settings',
                roles: ['admin']
            },
            {
                id: 'jury',
                label: 'Jury Panel',
                href: 'dashboard-jury.html',
                icon: 'users',
                roles: ['admin', 'jury']
            }
        ]
    };

    // ═══════════════════════════════════════════
    // ICONS SVG
    // ═══════════════════════════════════════════
    
    const ICONS = {
        home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        trophy: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
        'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
        'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
    };

    function getIcon(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
    }

    // ═══════════════════════════════════════════
    // WRC NAVIGATION CLASS
    // ═══════════════════════════════════════════
    
    class WRCNavigation {
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
            this.injectStyles();
            this.createSidebar();
            this.createMobileElements();
            this.wrapContent();
            this.bindEvents();
            this.updateUserDisplay();
        }

        // ═══════════════════════════════════════════
        // TEMPLATE GENERATION
        // ═══════════════════════════════════════════

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
            
            // Inject into .wrc-app container or body
            const appContainer = document.querySelector('.wrc-app');
            if (appContainer) {
                appContainer.insertBefore(sidebar, appContainer.firstChild);
            } else {
                document.body.insertBefore(sidebar, document.body.firstChild);
            }
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
            // Overlay
            const overlay = document.createElement('div');
            overlay.className = 'wrc-overlay';
            overlay.id = 'wrcOverlay';
            document.body.appendChild(overlay);
            this.overlay = overlay;
            
            // Mobile Toggle
            const toggle = document.createElement('button');
            toggle.className = 'wrc-mobile-toggle';
            toggle.id = 'wrcMobileToggle';
            toggle.setAttribute('aria-label', 'Menu');
            toggle.innerHTML = getIcon('menu');
            document.body.appendChild(toggle);
            this.toggle = toggle;
            
            // Mobile Header
            const header = document.createElement('header');
            header.className = 'wrc-mobile-header';
            header.innerHTML = `
                <span class="wrc-mobile-header-title">WRC 2026</span>
            `;
            document.body.appendChild(header);
            this.mobileHeader = header;
        }

        wrapContent() {
            // Skip if structure already exists
            if (document.querySelector('.wrc-main')) {
                return;
            }
            
            // Find existing main content
            const main = document.querySelector('main, .main-container, #main-content');
            if (!main) return;
            
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'wrc-main';
            wrapper.id = 'wrcMain';
            
            // Move main into wrapper
            main.parentNode.insertBefore(wrapper, main);
            wrapper.appendChild(main);
        }

        // ═══════════════════════════════════════════
        // EVENT HANDLING
        // ═══════════════════════════════════════════

        bindEvents() {
            // Mobile toggle
            this.toggle.addEventListener('click', () => this.toggleSidebar());
            
            // Overlay click
            this.overlay.addEventListener('click', () => this.closeSidebar());
            
            // Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeSidebar();
                }
            });
            
            // Resize
            window.addEventListener('resize', () => {
                if (window.innerWidth >= CONFIG.breakpoint && this.isOpen) {
                    this.closeSidebar();
                }
            });
            
            // Nav items on mobile
            this.sidebar.querySelectorAll('.sidebar-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Mobile: fermer la sidebar
                    if (window.innerWidth < CONFIG.breakpoint) {
                        this.closeSidebar();
                    }
                    
                    // Navigation simple - laisser le navigateur gérer
                    const href = item.getAttribute('href');
                    if (href && href !== '#') {
                        // Mobile: fermer la sidebar d'abord
                        if (window.innerWidth < CONFIG.breakpoint) {
                            this.closeSidebar();
                        }
                        
                        // Vérifier si la page est protégée et user non connecté
                        const protectedPages = [
                            'dashboard.html', 'dashboard-admin.html', 'dashboard-jury.html',
                            'tournament-arena.html', 'profile-edit.html'
                        ];
                        
                        const isProtected = protectedPages.some(p => href.includes(p));
                        const isLoggedIn = window.wrcAuth?.isAuthenticated || 
                                          localStorage.getItem('wrc_user') || 
                                          sessionStorage.getItem('wrc_user');
                        
                        if (isProtected && !isLoggedIn) {
                            e.preventDefault();
                            // Ouvrir modal d'auth
                            if (window.openAuth) {
                                window.openAuth('fan');
                            }
                        }
                        // Sinon laisser la navigation normale
                    }
                });
            });
            
            // User click
            const userEl = document.getElementById('sidebarUser');
            if (userEl) {
                userEl.addEventListener('click', () => this.handleUserClick());
            }
            
            // Logout button
            const logoutBtn = document.getElementById('sidebarLogout');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.logout) {
                        window.logout();
                    } else {
                        localStorage.removeItem('wrc_user');
                        sessionStorage.removeItem('wrc_user');
                        window.location.href = 'index.html';
                    }
                });
            }
            
            // Auth change event
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

        // ═══════════════════════════════════════════
        // USER MANAGEMENT
        // ═══════════════════════════════════════════

        getUser() {
            try {
                const data = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
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
                const name = this.user.stage_name || this.user.email?.split('@')[0] || 'User';
                const roleLabels = {
                    admin: 'Administrateur',
                    jury: 'Membre du Jury',
                    artist: 'Artiste',
                    fan: 'Fan'
                };
                
                if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
                if (nameEl) nameEl.textContent = name;
                if (roleEl) roleEl.textContent = roleLabels[this.user.role] || 'Membre';
                
                // Show admin section if applicable
                if (adminSection) {
                    const showAdmin = this.user.role === 'admin' || this.user.role === 'jury';
                    adminSection.style.display = showAdmin ? 'block' : 'none';
                }
                
                // Show logout button
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
            } else {
                if (typeof window.openAuth === 'function') {
                    window.openAuth('fan');
                } else {
                    const modal = document.getElementById('authModal');
                    if (modal) modal.classList.add('show');
                }
            }
        }

        // ═══════════════════════════════════════════
        // UTILITIES
        // ═══════════════════════════════════════════

        detectCurrentPage() {
            const path = window.location.pathname;
            const file = path.split('/').pop() || 'index.html';
            return file;
        }

        isActivePage(href) {
            const current = this.currentPage;
            return href === current || 
                   (current === '' && href === 'index.html') ||
                   (current === 'index.html' && href === 'index.html');
        }

        injectStyles() {
            // Minimal critical styles to ensure sidebar works before CSS loads
            const style = document.createElement('style');
            style.textContent = `
                .wrc-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 200; }
                .wrc-main { transition: margin-left 300ms ease; }
                @media (max-width: 1023px) {
                    .wrc-sidebar { transform: translateX(-100%); }
                    .wrc-sidebar.open { transform: translateX(0); }
                    .wrc-main { margin-left: 0 !important; }
                }
                .sidebar-logout-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 10px 16px;
                    margin-top: 8px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    color: #ef4444;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .sidebar-logout-btn:hover {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: rgba(239, 68, 68, 0.5);
                }
                .sidebar-logout-text { opacity: 0; transition: opacity 0.2s; }
                .wrc-sidebar:hover .sidebar-logout-text { opacity: 1; }
            `;
            document.head.appendChild(style);
        }
    }

    // ═══════════════════════════════════════════
    // INITIALIZE
    // ═══════════════════════════════════════════
    
    window.WRCNavigation = WRCNavigation;
    window.wrcNav = new WRCNavigation();

})();
