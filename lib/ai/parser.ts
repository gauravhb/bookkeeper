/* eslint-disable @typescript-eslint/no-require-imports */
import type { ExpenseCategory } from '../types'

// Use require to avoid ESM/CJS interop issues with Jest mocking
const OpenAIModule = require('openai')
const OpenAI = OpenAIModule.default ?? OpenAIModule

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-120b:free'

export type ParsedExpense = {
  item: string
  amount: number
  category: ExpenseCategory
  note: string | null
}

export async function parseExpenseMessage(message: string): Promise<ParsedExpense | null> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: `Extract expense from: "${message}"\nReturn JSON: {"item":string,"amount":number,"category":"Food"|"Travel"|"Utilities"|"Shopping"|"Health"|"Other","note":string|null}\nIf no amount found, return {"error":"no_amount"}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100,
  })

  const text = response.choices[0]?.message?.content
  if (!text) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (parsed.error || typeof parsed.amount !== 'number') return null

  return parsed as unknown as ParsedExpense
}
