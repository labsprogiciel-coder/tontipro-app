//convex/dashboard.ts
import { query } from './_generated/server'
import { v } from 'convex/values'

// ─── helpers ────────────────────────────────────────────────────────────────

function toYYYYMM(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7) // "2026-04"
}

function last12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

// ─── branchSummary ──────────────────────────────────────────────────────────

export const branchSummary = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    // Enforce branch membership
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user || user.branchId !== args.branchId) {
      throw new Error('Unauthorized: Cannot view dashboard for this branch')
    }

    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = today.slice(0, 7) + '-01'
    const startOfMonthTs = new Date(startOfMonth).getTime()

    // 1. parallel fetches
    const [customers, transactions, goals, reconciliations, users] = await Promise.all([
      ctx.db
        .query('customers')
        .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
        .order('desc')
        .collect(),

      ctx.db
        .query('transactions')
        .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
        .order('desc')
        .take(500), // enough for 12-month volume + recent feed

      ctx.db
        .query('savingsGoals')
        .withIndex('by_branch_status', (q) => q.eq('branchId', args.branchId))
        .collect(),

      ctx.db
        .query('reconciliations')
        .withIndex('by_branch_status', (q) => q.eq('branchId', args.branchId))
        .order('desc')
        .take(10),

      ctx.db
        .query('users')
        .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
        .collect(),
    ])

    // 2. Create lookup maps
    const userMap = Object.fromEntries(users.map((u) => [u._id, u]))
    const customerMap = Object.fromEntries(customers.map((c) => [c._id, c]))

    // 3. KPIs
    const verifiedCustomers = customers.filter((c) => c.status === 'verified')
    const activeClients = verifiedCustomers.length
    const newClients = verifiedCustomers.filter((c) => c.createdAt >= startOfMonthTs).length

    const monthlyTx = transactions.filter((t) => t.timestamp >= startOfMonthTs)
    const totalSavings = monthlyTx
      .filter((t) => t.status === 'completed' && t.type === 'deposit')
      .reduce((s, t) => s + t.amount, 0)
    const totalWithdrawals = monthlyTx
      .filter((t) => t.status === 'completed' && t.type === 'withdrawal')
      .reduce((s, t) => s + t.amount, 0)
    const pendingTx = transactions.filter((t) => t.status === 'pending').length

    // 4. recent transactions (feed card) - with customer names
    const recentTx = transactions.slice(0, 6).map((t) => {
      const customer = customerMap[t.customerId]
      return {
        ...t,
        customerName: customer?.fullName ?? 'Client inconnu',
      }
    })

    // 5. top savings goals - compute progress percentage
    const goalsWithProgress = goals.map((g) => {
      // Compute progress as percentage of target
      const goalTx = transactions.filter(
        (t) => t.customerId === g.customerId && t.status === 'completed' && t.type === 'deposit'
      )
      const currentAmount = goalTx.reduce((s, t) => s + t.amount, 0)
      const pct = g.targetAmount > 0 ? Math.round((currentAmount / g.targetAmount) * 100) : 0
      return { ...g, pct, currentAmount }
    })

    const topGoals = goalsWithProgress.sort((a, b) => b.pct - a.pct).slice(0, 4)

    // 6. monthly volume chart (last 12 months)
    const months = last12Months()
    const volumeMap: Record<string, { in: number; out: number }> = {}
    for (const m of months) volumeMap[m] = { in: 0, out: 0 }

    for (const t of transactions) {
      if (t.status !== 'completed') continue
      const m = toYYYYMM(t.timestamp)
      if (!volumeMap[m]) continue
      if (t.type === 'deposit') volumeMap[m].in += t.amount
      if (t.type === 'withdrawal') volumeMap[m].out += t.amount
    }

    const monthlyVolume = months.map((m) => ({
      m,
      label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      in: volumeMap[m].in,
      out: volumeMap[m].out,
    }))

    // 7. activity feed — join tx + reconciliations, sorted by timestamp
    const txFeedItems = recentTx.map((t) => {
      const customer = customerMap[t.customerId]
      const user = userMap[t.agentId]
      return {
        id: t._id,
        kind: 'transaction' as const,
        type: t.type,
        amount: t.amount,
        status: t.status,
        timestamp: t.timestamp,
        customer: customer?.fullName ?? 'Client inconnu',
        agent: user?.fullName ?? 'Agent inconnu',
        ref: t.tpeId ?? null,
      }
    })

    const recFeedItems = reconciliations.map((r) => {
      const user = userMap[r.agentId]
      return {
        id: r._id,
        kind: 'reconciliation' as const,
        type: 'reconciliation',
        amount: r.variance ?? 0,
        status: r.status,
        timestamp: r.timestamp,
        customer: user?.fullName ?? 'Agent',
        agent: user?.fullName ?? 'Agent',
        ref: r.date ?? null,
      }
    })

    const activityFeed = [...txFeedItems, ...recFeedItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)

    // 8. recent clients
    const recentClients = customers
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((c) => ({
        id: c._id,
        name: c.fullName,
        phone: c.phoneNumber ?? null,
        status: c.status,
        balance: c.balance ?? 0,
        joined: c.createdAt,
      }))

    return {
      // KPIs
      activeClients,
      newClients,
      totalSavings,
      totalWithdrawals,
      pendingTx,
      // cards
      recentTx,
      recentClients,
      topGoals,
      // chart
      monthlyVolume,
      // feed
      activityFeed,
    }
  },
})
