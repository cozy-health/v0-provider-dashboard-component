import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const next = createRequire(import.meta.url)('next')

export async function createIsolatedTestApp(name) {
  if (!/^[a-z-]+$/.test(name)) throw new Error('Invalid integration fixture name')
  const dir = fileURLToPath(new URL('../', import.meta.url))
  await mkdir(resolve(dir, 'scratch'), { recursive: true })
  const tsconfigPath = `scratch/tsconfig-${name}.json`
  await writeFile(resolve(dir, tsconfigPath), JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: { tsBuildInfoFile: `./${name}.tsbuildinfo` },
    include: ['../next-env.d.ts', '../**/*.ts', '../**/*.tsx'],
    exclude: ['../node_modules', '../scratch'],
  }, null, 2) + '\n')
  process.env.COZY_INTEGRATION_FIXTURE = name
  return next({
    dev: true,
    dir,
    hostname: '127.0.0.1',
  })
}
