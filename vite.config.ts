import { defineConfig } from 'vite'

// Netlify geeft tijdens het bouwen het adres van de site mee als URL. Dat zetten we in de
// link naar de voorbeeldafbeelding, want apps als WhatsApp en Teams willen een volledig adres.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const siteUrl = (env.URL ?? '').replace(/\/$/, '')

export default defineConfig({
  plugins: [
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
  ],
})
