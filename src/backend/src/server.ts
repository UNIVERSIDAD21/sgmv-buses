import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`SGMV API listening on port ${env.PORT}`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing SGMV API.`)
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
