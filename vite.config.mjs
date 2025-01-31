import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        https: {
            key: fs.readFileSync(path.resolve(process.cwd(), 'key.pem')),
            cert: fs.readFileSync(path.resolve(process.cwd(), 'cert.pem')),
        }
    }
})
