import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

export type LibraryAssetType = 'rack' | 'clip' | 'sample' | 'preset' | 'template' | 'max_for_live_device'

export type LibraryAsset = {
  path: string
  relativePath: string
  type: LibraryAssetType
  name: string
  extension: string
  tags: string[]
}

export type LibraryScanWarning = {
  code: string
  message: string
  details?: unknown
}

export type LibraryInventory = {
  scanVersion: 1
  libraryPath: string
  exists: boolean
  assetCount: number
  typeCounts: Record<LibraryAssetType, number>
  assets: LibraryAsset[]
}

export type LibraryScanResult = {
  inventory: LibraryInventory
  warnings: LibraryScanWarning[]
}

export type ScanLibraryOptions = {
  libraryPath?: string
}

const assetTypeByExtension: Record<string, LibraryAssetType> = {
  '.adg': 'rack',
  '.alc': 'clip',
  '.wav': 'sample',
  '.aif': 'sample',
  '.aiff': 'sample',
  '.flac': 'sample',
  '.mp3': 'sample',
  '.m4a': 'sample',
  '.ogg': 'sample',
  '.adv': 'preset',
  '.als': 'template',
  '.amxd': 'max_for_live_device'
}

const emptyTypeCounts = (): Record<LibraryAssetType, number> => ({
  rack: 0,
  clip: 0,
  sample: 0,
  preset: 0,
  template: 0,
  max_for_live_device: 0
})

export async function scanLibrary(options: ScanLibraryOptions = {}): Promise<LibraryScanResult> {
  const libraryPath = resolveLibraryPath(options.libraryPath ?? process.env.SCENELAB_LIBRARY_PATH ?? defaultLibraryPath())
  const warnings: LibraryScanWarning[] = []

  try {
    const rootStat = await stat(libraryPath)

    if (!rootStat.isDirectory()) {
      return {
        inventory: buildInventory(libraryPath, false, []),
        warnings: [
          {
            code: 'library_not_directory',
            message: `Ableton User Library path is not a directory: ${libraryPath}`,
            details: { libraryPath }
          }
        ]
      }
    }
  } catch (error) {
    const code = getErrorCode(error)

    return {
      inventory: buildInventory(libraryPath, false, []),
      warnings: [
        {
          code: code === 'ENOENT' ? 'library_missing' : 'library_unreadable',
          message: code === 'ENOENT'
            ? `Ableton User Library was not found: ${libraryPath}`
            : `Ableton User Library could not be read: ${libraryPath}`,
          details: {
            libraryPath,
            code,
            message: error instanceof Error ? error.message : String(error)
          }
        }
      ]
    }
  }

  const assets = await findAssets(libraryPath, libraryPath, warnings)
  assets.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  return {
    inventory: buildInventory(libraryPath, true, assets),
    warnings
  }
}

function defaultLibraryPath(): string {
  return path.join(homedir(), 'Music', 'Ableton', 'User Library')
}

function resolveLibraryPath(libraryPath: string): string {
  if (libraryPath === '~') {
    return homedir()
  }

  if (libraryPath.startsWith(`~${path.sep}`)) {
    return path.join(homedir(), libraryPath.slice(2))
  }

  return path.resolve(libraryPath)
}

async function findAssets(root: string, directory: string, warnings: LibraryScanWarning[]): Promise<LibraryAsset[]> {
  let entries

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    warnings.push({
      code: 'library_directory_unreadable',
      message: `Library directory could not be read: ${directory}`,
      details: {
        path: directory,
        message: error instanceof Error ? error.message : String(error)
      }
    })
    return []
  }

  const assets: LibraryAsset[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      assets.push(...await findAssets(root, entryPath, warnings))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const asset = assetFromPath(root, entryPath)

    if (asset) {
      assets.push(asset)
    }
  }

  return assets
}

function assetFromPath(root: string, filePath: string): LibraryAsset | null {
  const extension = path.extname(filePath).toLowerCase()
  const type = assetTypeByExtension[extension]

  if (!type) {
    return null
  }

  const relativePath = path.relative(root, filePath).split(path.sep).join('/')
  const name = path.basename(filePath, path.extname(filePath))

  return {
    path: filePath,
    relativePath,
    type,
    name,
    extension,
    tags: inferTags(type, name, relativePath)
  }
}

function buildInventory(libraryPath: string, exists: boolean, assets: LibraryAsset[]): LibraryInventory {
  const typeCounts = emptyTypeCounts()

  for (const asset of assets) {
    typeCounts[asset.type] += 1
  }

  return {
    scanVersion: 1,
    libraryPath,
    exists,
    assetCount: assets.length,
    typeCounts,
    assets
  }
}

function inferTags(type: LibraryAssetType, name: string, relativePath: string): string[] {
  const tokens = tokenize(`${relativePath} ${name}`)
  const tags: string[] = []

  addTags(tags, typeTags(type))

  const keywordTags: Array<[string, string[]]> = [
    ['drums', ['drum', 'drums', 'percussion']],
    ['kick', ['kick']],
    ['snare', ['snare']],
    ['hat', ['hat', 'hats', 'hihat', 'hi', 'cymbal', 'cymbals']],
    ['bass', ['bass', 'sub']],
    ['keys', ['key', 'keys', 'piano', 'rhodes', 'epiano']],
    ['synth', ['synth', 'synths', 'serum']],
    ['lead', ['lead', 'solo']],
    ['pad', ['pad', 'pads']],
    ['guitar', ['guitar', 'guitars']],
    ['vocal', ['vocal', 'vocals', 'voice']],
    ['brass', ['brass', 'horn', 'horns', 'trumpet', 'sax']],
    ['strings', ['string', 'strings', 'violin']],
    ['instrument', ['instrument', 'instruments']],
    ['audio-effect', ['audio', 'effect', 'effects']],
    ['midi-effect', ['midi']]
  ]

  for (const [tag, keywords] of keywordTags) {
    if (keywords.some((keyword) => tokens.has(keyword))) {
      addTag(tags, tag)
    }
  }

  return tags
}

function typeTags(type: LibraryAssetType): string[] {
  switch (type) {
    case 'rack':
      return ['rack']

    case 'clip':
      return ['clip']

    case 'sample':
      return ['sample', 'audio']

    case 'preset':
      return ['preset']

    case 'template':
      return ['template']

    case 'max_for_live_device':
      return ['max-for-live', 'device']
  }
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  )
}

function addTags(tags: string[], nextTags: string[]): void {
  for (const tag of nextTags) {
    addTag(tags, tag)
  }
}

function addTag(tags: string[], tag: string): void {
  if (!tags.includes(tag)) {
    tags.push(tag)
  }
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}
