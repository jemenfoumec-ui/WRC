# WRC 2026 - REFONTE V4

## 🎨 Nouveau Système de Design Unifié

### Architecture CSS (3 fichiers principaux)
| Fichier | Description |
|---------|-------------|
| `wrc-core.css` | Variables, reset, typographie, utilities |
| `wrc-layout.css` | App Shell, sidebar, grilles, responsive |
| `wrc-components.css` | Composants UI (cards, buttons, modals, skeletons) |

### JavaScript
| Fichier | Description |
|---------|-------------|
| `wrc-nav.js` | Navigation sidebar dynamique |
| `wrc-auth.js` | 🔐 Guard d'authentification + transitions fluides |

---

## 🔐 Système de Sécurité

### Pages protégées (connexion requise)
- `dashboard.html` - Dashboard général
- `dashboard-admin.html` - Panel admin (rôle: admin)
- `dashboard-jury.html` - Panel jury (rôle: jury/admin)
- `tournament-arena.html` - Arène de battle
- `profile-edit.html` - Profil utilisateur

### Fonctionnement
1. **Utilisateur non connecté** → Overlay avec invitation connexion/inscription
2. **Rôle insuffisant** → Message d'accès refusé + retour accueil
3. **Auth réussie** → Contenu débloqué avec transition fluide

---

## ✨ Transitions Style Suno

### Features
- **Page Enter** : Fade in + slide up (400ms)
- **Page Exit** : Fade out + scale down (300ms)
- **Prefetch** : Préchargement au hover sur les liens
- **Loader** : Spinner animé pendant le chargement
- **Skeletons** : Placeholders animés pour le contenu

### Gestion du state
- `localStorage` : Connexion persistante
- `sessionStorage` : Connexion temporaire
- Event `wrc-auth-change` : Synchronisation cross-component

---

## 📁 Structure des fichiers

```
WRC-V4-REFONTE/
├── wrc-core.css        # Design tokens & base
├── wrc-layout.css      # Layout & sidebar
├── wrc-components.css  # UI components
├── wrc-nav.js          # Navigation
├── wrc-auth.js         # Auth guard & transitions
├── index.html          # Accueil (public)
├── dashboard.html      # Dashboard (auth)
├── dashboard-admin.html # Admin (admin only)
├── dashboard-jury.html  # Jury (jury/admin)
├── tournament-arena.html # Arène (auth)
├── tournament-registration.html # Inscription
├── protocol.html       # Règlement (public)
├── faq.html           # FAQ (public)
├── profile-edit.html  # Profil (auth)
└── [autres fichiers JS/CSS spécifiques]
```

---

## 🚀 Installation

1. Remplacer tous les fichiers
2. Configurer Supabase dans `config.js`
3. Les fonts Google restent les mêmes

---

WRC 2026 © Design System v4.0 - Auth & Transitions
