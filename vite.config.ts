import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function reminderServerPlugin(): Plugin {
  return {
    name: 'reminder-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/reminders')) return next?.()
        try {
          const mod = await server.ssrLoadModule('/src/reminders/server-handler.ts')
          return mod.reminderApiMiddleware()(req, res, next)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), reminderServerPlugin()],
})
