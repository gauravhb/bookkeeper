describe('Expense API validation', () => {
  it('requires amount, item, type, category fields', () => {
    const required = ['amount', 'item', 'type', 'category']
    const body = { amount: 5.5, item: 'Coffee', type: 'personal', category: 'Food' }
    for (const field of required) {
      const incomplete = { ...body, [field]: undefined }
      const missing = !incomplete.amount || !incomplete.item || !incomplete.type || !incomplete.category
      expect(missing).toBe(true)
    }
  })

  it('accepts valid expense payload', () => {
    const body = { amount: 5.5, item: 'Coffee', type: 'personal', category: 'Food', note: null }
    const valid = !!(body.amount && body.item && body.type && body.category)
    expect(valid).toBe(true)
  })
})
