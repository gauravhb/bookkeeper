const mockCreate = jest.fn()

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { parseExpenseMessage } from '../../../lib/ai/parser'

describe('parseExpenseMessage', () => {
  beforeEach(() => mockCreate.mockClear())

  it('parses a simple expense', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ item: 'Coffee', amount: 5.5, category: 'Food', note: null }) } }],
    })
    const result = await parseExpenseMessage('Coffee 5.50')
    expect(result).toEqual({ item: 'Coffee', amount: 5.5, category: 'Food', note: null })
  })

  it('parses expense with note', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ item: 'Electricity bill', amount: 2100, category: 'Utilities', note: 'paid online' }) } }],
    })
    const result = await parseExpenseMessage('Electricity bill 2100 - paid online')
    expect(result).toEqual({ item: 'Electricity bill', amount: 2100, category: 'Utilities', note: 'paid online' })
  })

  it('returns null when no amount found', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ error: 'no_amount' }) } }],
    })
    const result = await parseExpenseMessage('hello there')
    expect(result).toBeNull()
  })

  it('returns null when API returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
    const result = await parseExpenseMessage('anything')
    expect(result).toBeNull()
  })
})
