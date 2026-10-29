// Divisão por pessoa dentro de uma mesa.
//
// Regras (definidas com o Victor em 29/10/2026):
//  - item com guestId pertence à pessoa; item sem guestId é da mesa (compartilhado)
//    e NÃO é rateado: fica como "parte da mesa", que o pessoal divide manualmente;
//  - pagamento com guestId abate a parte da pessoa; pagamento sem guestId abate
//    a parte da mesa. A mesa só libera quando a soma de todos os pagamentos
//    cobrir o total, como sempre foi;
//  - pagar a mais que a própria parte não é bloqueado: o excedente conta para a
//    mesa (abate do que falta) e aparece como "pago a mais" na pessoa.
//
// Tudo em centavos inteiros para evitar erro de ponto flutuante. Usado pela API
// (conta impressa) e pelo celular (tela de pagamento), para os dois baterem.

export interface ShareItemLike { guestId: string | null; qty: number; unitPrice: number; cancelled: boolean }
export interface SharePaymentLike { guestId: string | null; amount: number }
export interface ShareGuestLike { id: string; name: string; position: number }

export interface GuestShare {
  guestId: string
  name: string
  itemsCents: number     // itens próprios
  sharedCents: number    // sempre 0 (itens da mesa não são rateados); mantido por compatibilidade
  totalCents: number     // = itemsCents
  paidCents: number      // pagamentos marcados como desta pessoa
  dueCents: number       // max(0, total - pago)
  overpaidCents: number  // max(0, pago - total)
}

export interface SaleShares {
  guests: GuestShare[]
  sharedCents: number          // total dos itens da mesa (sem pessoa) = parte da mesa
  unassignedPaidCents: number  // pagamentos sem pessoa (abatem a parte da mesa)
  tableDueCents: number        // max(0, sharedCents - unassignedPaidCents)
  totalCents: number
  paidCents: number
  dueCents: number
}

export function toCents(n: number): number {
  return Math.round(n * 100)
}

export function computeShares(sale: {
  items: ShareItemLike[]
  payments: SharePaymentLike[]
  guests: ShareGuestLike[]
}): SaleShares {
  const active = sale.items.filter((i) => !i.cancelled)
  const guests = [...sale.guests].sort((a, b) => a.position - b.position)

  const itemsByGuest = new Map<string, number>()
  let sharedCents = 0
  for (const i of active) {
    const c = toCents(i.unitPrice) * i.qty
    if (i.guestId && guests.some((g) => g.id === i.guestId)) {
      itemsByGuest.set(i.guestId, (itemsByGuest.get(i.guestId) ?? 0) + c)
    } else {
      sharedCents += c
    }
  }

  const paidByGuest = new Map<string, number>()
  let unassignedPaidCents = 0
  for (const p of sale.payments) {
    const c = toCents(p.amount)
    if (p.guestId && guests.some((g) => g.id === p.guestId)) {
      paidByGuest.set(p.guestId, (paidByGuest.get(p.guestId) ?? 0) + c)
    } else {
      unassignedPaidCents += c
    }
  }

  const shares: GuestShare[] = guests.map((g) => {
    const itemsCents = itemsByGuest.get(g.id) ?? 0
    const sharedPart = 0
    const totalCents = itemsCents
    const paidCents = paidByGuest.get(g.id) ?? 0
    return {
      guestId: g.id,
      name: g.name,
      itemsCents,
      sharedCents: sharedPart,
      totalCents,
      paidCents,
      dueCents: Math.max(0, totalCents - paidCents),
      overpaidCents: Math.max(0, paidCents - totalCents),
    }
  })

  const totalCents = active.reduce((s, i) => s + toCents(i.unitPrice) * i.qty, 0)
  const paidCents = sale.payments.reduce((s, p) => s + toCents(p.amount), 0)

  return {
    guests: shares,
    sharedCents,
    unassignedPaidCents,
    tableDueCents: Math.max(0, sharedCents - unassignedPaidCents),
    totalCents,
    paidCents,
    dueCents: Math.max(0, totalCents - paidCents),
  }
}
