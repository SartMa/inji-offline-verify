/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
	export function registerSW(options?: any): (reloadPage?: boolean) => void
}

declare module '*.jsx' {
	const ReactComponent: any
	export default ReactComponent
}
