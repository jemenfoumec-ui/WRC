import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'writable',
        document: 'writable',
        console: 'writable',
        localStorage: 'writable',
        sessionStorage: 'writable',
        setTimeout: 'writable',
        setInterval: 'writable',
        clearTimeout: 'writable',
        clearInterval: 'writable',
        CustomEvent: 'writable',
        URL: 'writable',
        Node: 'writable',
        FormData: 'writable',
        File: 'writable',
        Blob: 'writable',
        navigator: 'writable',
        location: 'writable',
        history: 'writable',
        matchMedia: 'writable',
        requestAnimationFrame: 'writable',
        cancelAnimationFrame: 'writable',
        fetch: 'writable',
        WebSocket: 'writable',
        Audio: 'writable',
        Image: 'writable',
        HTMLElement: 'writable',
        Element: 'writable',
        Event: 'writable',
        Error: 'writable',
        IntersectionObserver: 'writable'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'off',
      'no-undef': 'off'
    }
  }
];