#!/usr/bin/env node
// 把 package.json 的 version 同步进 public/manifest.json，避免两处手改
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const manifestPath = 'public/manifest.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`manifest.json → v${pkg.version}`)
}
