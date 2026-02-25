// Simple frontend config - API base URL
const rawBase = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
// Ensure the API base always points to the '/api' prefix
function ensureApiBase(base: string) {
	const trimmed = base.trim();
	if (trimmed.endsWith('/api')) return trimmed.replace(/\/$/, '');
	// remove trailing slash then append /api
	return trimmed.replace(/\/$/, '') + '/api';
}

export const API_BASE = ensureApiBase(rawBase);

