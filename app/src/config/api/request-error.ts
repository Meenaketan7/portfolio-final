import { toast } from 'svelte-sonner';

export function showRequestError(error: unknown) {
	const message =
		error instanceof Error && error.message
			? error.message
			: 'Something went wrong. Please try again.';

	toast.error(message);
}
