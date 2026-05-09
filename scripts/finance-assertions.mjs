import assert from "node:assert/strict"

const toCents = (value) => Math.round(Number(value) * 100)
const fromCents = (value) => value / 100
const roundMoney = (value) => fromCents(toCents(value))

const convertUsdCentsToVesCents = (usdCents, rateCents) =>
  Math.round((usdCents * rateCents) / 100)

const convertVesCentsToUsdCents = (vesCents, rateCents) =>
  Math.round((vesCents * 100) / rateCents)

const allocatePaymentByLine = (lines, payments) => {
  const totalCents = lines.reduce((sum, line) => sum + toCents(line.totalUsd), 0)
  let assignedCents = 0

  return lines.map((line, idx) => {
    const lineCents = idx === lines.length - 1
      ? totalCents - assignedCents
      : Math.round((toCents(line.totalUsd) * totalCents) / totalCents)
    assignedCents += lineCents
    const ratio = totalCents > 0 ? lineCents / totalCents : 0

    return payments.map((payment) => ({
      ...payment,
      amount: roundMoney(payment.amount * ratio),
    }))
  })
}

const scaleLegacyRepeatedDetails = (saleTotalUsd, detailTotalsUsd) => {
  const allocated = detailTotalsUsd.reduce((sum, value) => sum + value, 0)
  const shouldScale = saleTotalUsd > 0 && allocated / saleTotalUsd > 1.05
  if (!shouldScale || allocated <= 0) return detailTotalsUsd.map(roundMoney)
  const scale = saleTotalUsd / allocated
  return detailTotalsUsd.map((value) => roundMoney(value * scale))
}

const rateCents = toCents(40)

assert.equal(toCents(4000), 400000)
assert.equal(convertVesCentsToUsdCents(400000, rateCents), 10000)
assert.equal(fromCents(convertVesCentsToUsdCents(400000, rateCents)), 100)
assert.equal(fromCents(convertUsdCentsToVesCents(10000, rateCents)), 4000)

const mixedPayments = [
  { method: "efectivo_bs", amount: 2400, currency: "VES" },
  { method: "efectivo_usd", amount: 40, currency: "USD" },
]
assert.equal(fromCents(convertVesCentsToUsdCents(toCents(mixedPayments[0].amount), rateCents)) + mixedPayments[1].amount, 100)

const paidVesCents = toCents(5000)
const changeVesCents = toCents(1000)
assert.equal(fromCents(paidVesCents - changeVesCents), 4000)
assert.equal(fromCents(convertVesCentsToUsdCents(paidVesCents - changeVesCents, rateCents)), 100)

const allocations = allocatePaymentByLine(
  [{ totalUsd: 25 }, { totalUsd: 75 }],
  [{ method: "pago_movil", amount: 4000, currency: "VES" }],
)
assert.deepEqual(allocations.map((entry) => entry[0].amount), [1000, 3000])

assert.deepEqual(scaleLegacyRepeatedDetails(25, [100]), [25])
assert.deepEqual(scaleLegacyRepeatedDetails(75, [100]), [75])

const buildCashCloseLine = ({ expectedUsd, expectedVes, countedUsd = 0, countedVes = 0, nativeCurrency }) => {
  const diffUsd = roundMoney(countedUsd - expectedUsd)
  const diffVes = roundMoney(countedVes - expectedVes)
  return {
    diffUsd,
    diffVes,
    hasDifference: Math.abs(nativeCurrency === "VES" ? diffVes : diffUsd) > 0.009,
  }
}

const pagoMovilClose = buildCashCloseLine({
  expectedUsd: 75,
  expectedVes: 3000,
  countedVes: 3000,
  nativeCurrency: "VES",
})
assert.equal(pagoMovilClose.diffVes, 0)
assert.equal(pagoMovilClose.hasDifference, false)

const cashUsdClose = buildCashCloseLine({
  expectedUsd: 40,
  expectedVes: 0,
  countedUsd: 35,
  nativeCurrency: "USD",
})
assert.equal(cashUsdClose.diffUsd, -5)
assert.equal(cashUsdClose.hasDifference, true)

const buildClosureMovement = ({ closedUsd, closedVes, currentUsd, currentVes }) => ({
  usd: roundMoney(currentUsd - closedUsd),
  ves: roundMoney(currentVes - closedVes),
})

const closureMovement = buildClosureMovement({
  closedUsd: 0,
  closedVes: 10379.55,
  currentUsd: 0,
  currentVes: 18379.55,
})
assert.equal(closureMovement.usd, 0)
assert.equal(closureMovement.ves, 8000)

const getCurrencyAmounts = ({ amount, currency, rate }) => {
  const normalizedCurrency = String(currency || "USD").toUpperCase()
  if (normalizedCurrency === "USD" || normalizedCurrency === "US$") {
    return {
      usd: roundMoney(amount),
      ves: roundMoney(fromCents(convertUsdCentsToVesCents(toCents(amount), toCents(rate)))),
    }
  }
  return {
    usd: roundMoney(fromCents(convertVesCentsToUsdCents(toCents(amount), toCents(rate)))),
    ves: roundMoney(amount),
  }
}

const vesTicketAmounts = getCurrencyAmounts({ amount: 4000, currency: "VES", rate: 484.74 })
assert.equal(vesTicketAmounts.ves, 4000)
assert.equal(vesTicketAmounts.usd, 8.25)

const usdTicketAmounts = getCurrencyAmounts({ amount: 8.25, currency: "USD", rate: 484.74 })
assert.equal(usdTicketAmounts.usd, 8.25)
assert.equal(usdTicketAmounts.ves, 3999.11)

const normalizePersistedPaymentDetail = ({ method, amount, currency, rate }) => {
  const currencyNative = currency || (["efectivo_bs", "pago_movil", "punto", "transferencia"].includes(method) ? "VES" : "USD")
  const amountUsd = currencyNative === "VES" ? roundMoney(amount / rate) : roundMoney(amount)
  return {
    method,
    amount,
    currency: currencyNative,
    amountNative: amount,
    currencyNative,
    amountUsd,
    exchangeRate: rate,
  }
}

assert.deepEqual(normalizePersistedPaymentDetail({
  method: "pago_movil",
  amount: 4000,
  currency: "VES",
  rate: 400,
}), {
  method: "pago_movil",
  amount: 4000,
  currency: "VES",
  amountNative: 4000,
  currencyNative: "VES",
  amountUsd: 10,
  exchangeRate: 400,
})

const dashboardMoneyTotals = [
  { amount: 7, currency: "USD", rate: 400 },
  { amount: 4000, currency: "VES", rate: 400 },
].reduce((acc, entry) => {
  const amounts = getCurrencyAmounts(entry)
  acc.equivalentUsd += amounts.usd
  if (entry.currency === "VES") acc.nativeVes += entry.amount
  else acc.nativeUsd += entry.amount
  return acc
}, { equivalentUsd: 0, nativeUsd: 0, nativeVes: 0 })

assert.deepEqual(dashboardMoneyTotals, { equivalentUsd: 17, nativeUsd: 7, nativeVes: 4000 })

const validateClosureLine = (line) => {
  for (const field of ["expectedUsd", "expectedVes", "countedUsd", "countedVes", "diffUsd", "diffVes"]) {
    if (line[field] === undefined || line[field] === null || line[field] === "") {
      throw new Error(`missing ${field}`)
    }
    if (!Number.isFinite(Number(line[field]))) {
      throw new Error(`invalid ${field}`)
    }
  }
}

assert.throws(() => validateClosureLine({ method: "pago_movil", countedVes: 4000 }), /missing expectedUsd/)

const checkoutRateCents = toCents(485.23)
const settleCheckout = ({ totalUsdCents, payments, changes, rateCents }) => {
  const paidUsdCents = payments.reduce((sum, payment) => {
    return sum + (payment.currency === "VES"
      ? convertVesCentsToUsdCents(payment.amountCents, rateCents)
      : payment.amountCents)
  }, 0)
  const changeUsdCents = changes.reduce((sum, change) => {
    return sum + (change.currency === "VES"
      ? convertVesCentsToUsdCents(change.amountCents, rateCents)
      : change.amountCents)
  }, 0)
  const changeDueUsdCents = Math.max(0, paidUsdCents - totalUsdCents)
  return {
    paidUsdCents,
    changeDueUsdCents,
    changeDueVesCents: convertUsdCentsToVesCents(changeDueUsdCents, rateCents),
    changeRemainingUsdCents: changeDueUsdCents - changeUsdCents,
  }
}

const settleCheckoutDualBasis = ({ totalUsdCents, payments, changes, rateCents }) => {
  const totalVesCents = convertUsdCentsToVesCents(totalUsdCents, rateCents)
  const paid = payments.reduce((sum, payment) => {
    if (payment.currency === "VES") {
      sum.usdCents += convertVesCentsToUsdCents(payment.amountCents, rateCents)
      sum.vesCents += payment.amountCents
      return sum
    }
    sum.usdCents += payment.amountCents
    sum.vesCents += convertUsdCentsToVesCents(payment.amountCents, rateCents)
    return sum
  }, { usdCents: 0, vesCents: 0 })
  const changed = changes.reduce((sum, change) => {
    if (change.currency === "VES") {
      sum.usdCents += convertVesCentsToUsdCents(change.amountCents, rateCents)
      sum.vesCents += change.amountCents
      return sum
    }
    sum.usdCents += change.amountCents
    sum.vesCents += convertUsdCentsToVesCents(change.amountCents, rateCents)
    return sum
  }, { usdCents: 0, vesCents: 0 })
  return {
    totalVesCents,
    paidUsdCents: paid.usdCents,
    paidVesCents: paid.vesCents,
    changeDueUsdCents: Math.max(0, paid.usdCents - totalUsdCents),
    changeDueVesCents: Math.max(0, paid.vesCents - totalVesCents),
    changeRemainingUsdCents: Math.max(0, paid.usdCents - totalUsdCents) - changed.usdCents,
    changeRemainingVesCents: Math.max(0, paid.vesCents - totalVesCents) - changed.vesCents,
  }
}

const evaluateChangeSettlement = ({ changeDueUsdCents, changeDueVesCents, changes, rateCents }) => {
  const changed = changes.reduce((sum, change) => {
    if (change.currency === "VES") {
      sum.usdCents += convertVesCentsToUsdCents(change.amountCents, rateCents)
      sum.vesCents += change.amountCents
      return sum
    }
    sum.usdCents += change.amountCents
    sum.vesCents += convertUsdCentsToVesCents(change.amountCents, rateCents)
    return sum
  }, { usdCents: 0, vesCents: 0 })
  const hasUsdChange = changed.usdCents > 0 && changes.some((change) => change.currency === "USD")
  const hasVesChange = changed.vesCents > 0 && changes.some((change) => change.currency === "VES")
  const requiresVes = changeDueVesCents > 0 && (changeDueUsdCents <= 0 || hasVesChange)
  const requiresUsd = changeDueUsdCents > 0 && (!requiresVes || hasUsdChange)
  const remainingUsdCents = changeDueUsdCents - changed.usdCents
  const remainingVesCents = changeDueVesCents - changed.vesCents
  return {
    requiresUsd,
    requiresVes,
    remainingUsdCents,
    remainingVesCents,
    settled: (!requiresUsd || remainingUsdCents === 0) && (!requiresVes || remainingVesCents === 0),
  }
}

const totalDueUsdCents = toCents(9.33)
const totalDueVesCents = convertUsdCentsToVesCents(totalDueUsdCents, checkoutRateCents)
const usdChangeCheckout = settleCheckout({
  totalUsdCents: totalDueUsdCents,
  payments: [{ currency: "USD", amountCents: toCents(9.40) }],
  changes: [{ currency: "USD", amountCents: toCents(0.07) }],
  rateCents: checkoutRateCents,
})
assert.equal(totalDueVesCents, 452720)
assert.equal(usdChangeCheckout.changeDueUsdCents, 7)
assert.equal(usdChangeCheckout.changeDueVesCents, 3397)
assert.equal(usdChangeCheckout.changeRemainingUsdCents, 0)

const dualUsdChangeCheckout = settleCheckoutDualBasis({
  totalUsdCents: totalDueUsdCents,
  payments: [{ currency: "USD", amountCents: toCents(9.40) }],
  changes: [{ currency: "USD", amountCents: toCents(0.07) }],
  rateCents: checkoutRateCents,
})
assert.equal(dualUsdChangeCheckout.changeDueUsdCents, 7)
assert.equal(dualUsdChangeCheckout.changeDueVesCents, 3396)
assert.equal(dualUsdChangeCheckout.changeRemainingUsdCents, 0)

const vesChangeCheckout = settleCheckoutDualBasis({
  totalUsdCents: totalDueUsdCents,
  payments: [{ currency: "USD", amountCents: toCents(9.40) }],
  changes: [{ currency: "VES", amountCents: toCents(33.96) }],
  rateCents: checkoutRateCents,
})
assert.equal(vesChangeCheckout.changeDueVesCents, 3396)
assert.equal(vesChangeCheckout.changeRemainingVesCents, 0)
assert.equal(vesChangeCheckout.changeRemainingUsdCents, 0)

const mixedExactCheckout = settleCheckoutDualBasis({
  totalUsdCents: totalDueUsdCents,
  payments: [
    { currency: "USD", amountCents: toCents(5) },
    { currency: "VES", amountCents: toCents(2101.05) },
  ],
  changes: [],
  rateCents: checkoutRateCents,
})
assert.equal(mixedExactCheckout.paidUsdCents, totalDueUsdCents)
assert.equal(mixedExactCheckout.paidVesCents, totalDueVesCents)
assert.equal(mixedExactCheckout.changeDueUsdCents, 0)
assert.equal(mixedExactCheckout.changeDueVesCents, 0)

const mixedOverpayVesCheckout = settleCheckoutDualBasis({
  totalUsdCents: totalDueUsdCents,
  payments: [
    { currency: "USD", amountCents: toCents(5) },
    { currency: "VES", amountCents: toCents(2200) },
  ],
  changes: [{ currency: "VES", amountCents: toCents(98.95) }],
  rateCents: checkoutRateCents,
})
assert.equal(mixedOverpayVesCheckout.changeDueUsdCents, 20)
assert.equal(mixedOverpayVesCheckout.changeDueVesCents, 9895)
assert.equal(mixedOverpayVesCheckout.changeRemainingVesCents, 0)

const mixedOverpayUsdCheckout = settleCheckoutDualBasis({
  totalUsdCents: totalDueUsdCents,
  payments: [
    { currency: "USD", amountCents: toCents(5) },
    { currency: "VES", amountCents: toCents(2200) },
  ],
  changes: [{ currency: "USD", amountCents: toCents(0.20) }],
  rateCents: checkoutRateCents,
})
assert.equal(mixedOverpayUsdCheckout.changeRemainingUsdCents, 0)

const reportedTotalUsdCents = toCents(19.96)
const reportedPaymentUsdCents = toCents(25.51)
const reportedTotalVesCents = convertUsdCentsToVesCents(reportedTotalUsdCents, checkoutRateCents)
const reportedPaymentVesCents = convertUsdCentsToVesCents(reportedPaymentUsdCents, checkoutRateCents)
const reportedChangeDueUsdCents = reportedPaymentUsdCents - reportedTotalUsdCents
const reportedChangeDueVesCents = reportedPaymentVesCents - reportedTotalVesCents
assert.equal(reportedTotalVesCents, 968519)
assert.equal(reportedChangeDueUsdCents, 555)
assert.equal(reportedChangeDueVesCents, 269303)

const reportedMixedShortChange = evaluateChangeSettlement({
  changeDueUsdCents: reportedChangeDueUsdCents,
  changeDueVesCents: reportedChangeDueVesCents,
  changes: [
    { currency: "USD", amountCents: toCents(5.54) },
    { currency: "VES", amountCents: toCents(3.86) },
  ],
  rateCents: checkoutRateCents,
})
assert.equal(reportedMixedShortChange.remainingUsdCents, 0)
assert.equal(reportedMixedShortChange.remainingVesCents, 100)
assert.equal(reportedMixedShortChange.settled, false)

const reportedMixedExactChange = evaluateChangeSettlement({
  changeDueUsdCents: reportedChangeDueUsdCents,
  changeDueVesCents: reportedChangeDueVesCents,
  changes: [
    { currency: "USD", amountCents: toCents(5.54) },
    { currency: "VES", amountCents: toCents(4.86) },
  ],
  rateCents: checkoutRateCents,
})
assert.equal(reportedMixedExactChange.remainingUsdCents, 0)
assert.equal(reportedMixedExactChange.remainingVesCents, 0)
assert.equal(reportedMixedExactChange.settled, true)

console.log("finance assertions passed")
