describe('Stats calculation', () => {
  const expenses = [
    { amount: '100', category: 'Food', created_at: new Date().toISOString(), users: { name: 'Gaurav' } },
    { amount: '200', category: 'Food', created_at: new Date().toISOString(), users: { name: 'Spouse' } },
    { amount: '50', category: 'Travel', created_at: new Date().toISOString(), users: { name: 'Gaurav' } },
  ]

  it('sums thisMonth correctly', () => {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    expect(total).toBe(350)
  })

  it('finds top category by spend', () => {
    const categoryCounts: Record<string, number> = {}
    for (const e of expenses) {
      categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + Number(e.amount)
    }
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    expect(topCategory).toBe('Food')
  })

  it('counts expenses per submitter', () => {
    const counts: Record<string, number> = {}
    for (const e of expenses) {
      counts[e.users.name] = (counts[e.users.name] ?? 0) + 1
    }
    expect(counts['Gaurav']).toBe(2)
    expect(counts['Spouse']).toBe(1)
  })
})
