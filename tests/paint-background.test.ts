import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertPaintImages, discoverPaintImages } from '../vite.config'
import { selectPaintBackground } from '~/lib/paint-background'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('paint images', () => {
  it('discovers supported image files recursively with encoded public URLs', async () => {
    const directory = await createTemporaryDirectory()
    await mkdir(path.join(directory, 'nested folder'))
    await Promise.all([
      writeFile(path.join(directory, 'portrait.JPEG'), ''),
      writeFile(path.join(directory, 'nested folder', 'night sky.avif'), ''),
      writeFile(path.join(directory, 'nested folder', 'painting.gif'), ''),
      writeFile(path.join(directory, 'poster.png'), ''),
      writeFile(path.join(directory, 'sketch.svg'), ''),
      writeFile(path.join(directory, 'study.webp'), ''),
      writeFile(path.join(directory, 'ignored.txt'), '')
    ])

    await expect(discoverPaintImages(directory)).resolves.toEqual([
      '/images/paint/nested%20folder/night%20sky.avif',
      '/images/paint/nested%20folder/painting.gif',
      '/images/paint/portrait.JPEG',
      '/images/paint/poster.png',
      '/images/paint/sketch.svg',
      '/images/paint/study.webp'
    ])
  })

  it('raises a clear error when the directory is empty or missing', async () => {
    const directory = await createTemporaryDirectory()

    for (const paintDirectory of [directory, path.join(directory, 'missing')]) {
      const images = await discoverPaintImages(paintDirectory)

      expect(() => assertPaintImages(images, paintDirectory)).toThrow(
        `No paint images found in ${paintDirectory}`
      )
    }
  })

  it('selects first, middle, and last candidates from the actual array length', () => {
    const images = ['/first.jpg', '/middle.jpg', '/last.jpg']

    expect(selectPaintBackground(images, () => 0)).toBe('/first.jpg')
    expect(selectPaintBackground(images, () => 0.5)).toBe('/middle.jpg')
    expect(selectPaintBackground(images, () => 0.999999)).toBe('/last.jpg')
  })
})

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'paint-images-'))
  temporaryDirectories.push(directory)
  return directory
}
