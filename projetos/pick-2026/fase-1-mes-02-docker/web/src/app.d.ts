// See https://kit.svelte.dev/docs/types#app

interface AppUser {
	id: string;
	email: string;
	name?: string | null;
	tenantId: string;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: AppUser;
		}
		interface PageData {
			user?: AppUser;
			unavailable?: boolean;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
