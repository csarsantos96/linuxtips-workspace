import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./src/**/*.{html,svelte,ts,js}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// Paleta inspirada no giropops-status
				bg: {
					DEFAULT: '#0d1117',
					soft: '#161b22',
					sunken: '#010409'
				},
				surface: {
					DEFAULT: '#161b22',
					hover: '#1f262e',
					border: '#30363d'
				},
				accent: {
					DEFAULT: '#58a6ff',
					hover: '#79b8ff',
					muted: '#1f6feb'
				},
				success: '#3fb950',
				danger: '#f85149',
				warning: '#d29922',
				muted: {
					DEFAULT: '#8b949e',
					soft: '#6e7681'
				}
			},
			fontFamily: {
				sans: [
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'Roboto',
					'sans-serif'
				],
				mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
			},
			boxShadow: {
				card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4)'
			}
		}
	},
	plugins: []
};

export default config;
