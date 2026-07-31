import { sveltekit } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: false,
		host: true
	},
	preview: {
		port: 4173
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
