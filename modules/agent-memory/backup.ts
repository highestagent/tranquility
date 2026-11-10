import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { z } from "zod"

import {
  exportAll,
  kv,
  tranquilityDataSchema,
  type TranquilityData,
} from "@/modules/memory"

import type { Fact } from "./records"

/**
 * An encrypted copy of everything this browser holds that the agent's notes
 * don't: answers, game results, sessions, analyses, and the agent's log. It's
 * compressed and encrypted here with a key derived from the person's wallet,
 * so the relayer and Walrus only ever see ciphertext.
 *
 * Stored as chunks small enough that the relayer embeds them as they are
 * rather than summarizing them first, grouped into parts of at most 100 so one
 * recall reads a whole part.
 */

/** Under the relayer's 8 KB threshold for summarizing before embedding. */
export const CHUNK_CHARS = 7_500
/** A recall returns at most 100 memories. */
export const CHUNKS_PER_PART = 100
const VERSION = 1
const DEVICE_KEY = "agentMemory:device"
const IV_BYTES = 12

/** Research context. The rest of the key-value store is this device's own state. */
const KEYS = new Set(["contextAnswers", "seenDiscoveriesAt"])
const PREFIXES = ["sessionSummary:", "correction:"]

export function isBackedUpKey(key: string) {
  return KEYS.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix))
}

const payloadSchema = z.object({
  version: z.literal(VERSION),
  createdAt: z.number().int().nonnegative(),
  device: z.string(),
  data: tranquilityDataSchema,
})

export type BackupPayload = z.infer<typeof payloadSchema>

export async function collectBackupData(): Promise<TranquilityData> {
  const { data } = await exportAll()
  return { ...data, kv: data.kv.filter(({ key }) => isBackedUpKey(key)) }
}

/** Without answers or game results there's nothing worth keeping, or restoring over. */
export function hasRawData(
  data: Pick<TranquilityData, "responses" | "measurements">
) {
  return data.responses.length + data.measurements.length > 0
}

/** Unchanged data needn't be backed up again. */
export function fingerprint(data: TranquilityData) {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(data))))
}

/** Which browser wrote a backup, so each device's latest can be found. */
export async function getDeviceId() {
  const existing = await kv.get<string>(DEVICE_KEY)
  if (existing) return existing
  const id = bytesToHex(crypto.getRandomValues(new Uint8Array(8)))
  await kv.set(DEVICE_KEY, id)
  return id
}

async function transform(bytes: Uint8Array, stream: GenericTransformStream) {
  const output = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

function toBase64(bytes: Uint8Array) {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
}

/** Compresses, then encrypts with a fresh IV. Returns base64 of IV and ciphertext. */
export async function sealBackup(payload: BackupPayload, key: CryptoKey) {
  const compressed = await transform(
    new TextEncoder().encode(JSON.stringify(payload)),
    new CompressionStream("gzip")
  )
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, compressed)
  )
  const sealed = new Uint8Array(iv.length + ciphertext.length)
  sealed.set(iv)
  sealed.set(ciphertext, iv.length)
  return toBase64(sealed)
}

/** Fails if the text was changed or sealed with another key. */
export async function openBackup(sealed: string, key: CryptoKey) {
  const bytes = fromBase64(sealed)
  const compressed = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) },
      key,
      bytes.subarray(IV_BYTES)
    )
  )
  const json = new TextDecoder().decode(
    await transform(compressed, new DecompressionStream("gzip"))
  )
  return payloadSchema.parse(JSON.parse(json))
}

export function backupNamespace(
  device: string,
  createdAt: number,
  part: number,
  parts: number,
  chunks: number
) {
  return `backup:${device}:${createdAt}:${part}:${parts}:${chunks}`
}

/** The sealed backup as memories to send, each chunk led by its position. */
export function toBackupFacts(
  device: string,
  createdAt: number,
  sealed: string
): Fact[] {
  const chunks: string[] = []
  for (let at = 0; at < sealed.length; at += CHUNK_CHARS) {
    chunks.push(sealed.slice(at, at + CHUNK_CHARS))
  }
  const parts = Math.ceil(chunks.length / CHUNKS_PER_PART)
  return chunks.map((chunk, index) => {
    const part = Math.floor(index / CHUNKS_PER_PART)
    const inPart = Math.min(
      CHUNKS_PER_PART,
      chunks.length - part * CHUNKS_PER_PART
    )
    const namespace = backupNamespace(device, createdAt, part, parts, inPart)
    return { id: `${namespace}#${index}`, namespace, text: `${index}.${chunk}` }
  })
}

/** Puts chunks back in order. Retries can store one twice; a gap fails. */
export function joinBackup(texts: readonly string[], total: number) {
  const chunks = new Map<number, string>()
  for (const text of texts) {
    const dot = text.indexOf(".")
    const index = Number(text.slice(0, dot))
    if (dot > 0 && Number.isSafeInteger(index)) {
      chunks.set(index, text.slice(dot + 1))
    }
  }
  let sealed = ""
  for (let index = 0; index < total; index++) {
    const chunk = chunks.get(index)
    if (chunk === undefined) throw new Error("A backup chunk is missing")
    sealed += chunk
  }
  return sealed
}
