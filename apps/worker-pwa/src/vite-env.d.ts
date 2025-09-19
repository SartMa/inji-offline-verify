/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
	export function registerSW(options?: any): (reloadPage?: boolean) => void
}

// No .jsx modules used; all components are TSX
