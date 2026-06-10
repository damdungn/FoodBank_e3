// In dev, VITE_API_URL is unset → empty string → Vite proxy forwards /api/* to localhost:8000
// In production, set VITE_API_URL=https://foodbank-e3.onrender.com in Vercel env vars
export const API_BASE = import.meta.env.VITE_API_URL ?? "";
