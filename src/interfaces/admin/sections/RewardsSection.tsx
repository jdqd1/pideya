import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Gift,
  Globe,
  Hash,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Shapes,
  Tag,
  Ticket,
  Trash2,
  Trophy,
} from "lucide-react"
import type {
  LevelDefinition,
  LevelMonthlyCoupon,
  LoyaltyRulesResponse,
  RewardDefinition,
  RewardKind,
} from "../../../types/loyalty"

type RewardsSectionProps = {
  rules: LoyaltyRulesResponse
  defaultRules: LoyaltyRulesResponse
  onSaveRules: (rules: LoyaltyRulesResponse) => Promise<LoyaltyRulesResponse | void> | void
}

type DraftReward = RewardDefinition & { _uiId?: string; _isNew?: boolean }
type DraftRules = Omit<LoyaltyRulesResponse, "rewardLadder"> & { rewardLadder: DraftReward[] }

const rewardKindOptions: { value: RewardKind; label: string; legacy?: boolean }[] = [
  { value: "percent", label: "Descuento %" },
  { value: "free-item", label: "Producto gratis" },
  { value: "bogo", label: "2x1", legacy: true },
  { value: "combo", label: "Combo", legacy: true },
]

const cloneRules = (rules: LoyaltyRulesResponse): LoyaltyRulesResponse => {
  return JSON.parse(JSON.stringify(rules)) as LoyaltyRulesResponse
}

const createRewardUiId = () => `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const toDraftRules = (rules: LoyaltyRulesResponse): DraftRules => ({
  ...cloneRules(rules),
  rewardLadder: (rules.rewardLadder ?? []).map((reward, index) => ({
    ...reward,
    _uiId: (reward as DraftReward)._uiId ?? `reward-${reward.threshold}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  })),
})

const stripRewardMeta = (reward: DraftReward): RewardDefinition => {
  const { _uiId, _isNew, ...cleanReward } = reward
  return cleanReward
}

const readNumber = (raw: string) => {
  if (!raw.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const getRewardKindLabel = (kind: RewardKind) => {
  return rewardKindOptions.find((option) => option.value === kind)?.label ?? "Premio"
}

const applyLevelGlobals = (rules: LoyaltyRulesResponse) => {
  const expiry = rules.levelMonthlyCouponExpiryDays
  const renew = rules.levelMonthlyCouponRenewDay
  const ladder = rules.levelLadder ?? []
  return {
    ...rules,
    levelLadder: ladder.map((level) => ({
      ...level,
      perks: {
        ...level.perks,
        monthlyCouponExpiryDays: expiry ?? level.perks?.monthlyCouponExpiryDays,
        monthlyCouponRenewDay: renew ?? level.perks?.monthlyCouponRenewDay,
      },
    })),
  }
}

const cleanRulesForSave = (rules: DraftRules | LoyaltyRulesResponse): LoyaltyRulesResponse => ({
  ...rules,
  rewardLadder: (rules.rewardLadder ?? []).map((reward) => stripRewardMeta(reward as DraftReward)),
})

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 placeholder:text-slate-400"
const compactInputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 placeholder:text-slate-400"
const labelBase = "text-[11px] font-bold text-slate-500 uppercase tracking-wide"
const compactLabelBase = "text-[10px] font-black uppercase tracking-wide text-slate-500"
const iconButtonBase =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"

export default function RewardsSection({ rules, onSaveRules }: RewardsSectionProps) {
  const [draftRules, setDraftRules] = useState<DraftRules>(() => toDraftRules(rules))
  const [activeTab, setActiveTab] = useState<"points" | "levels" | "rules">("points")
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expandedRewardId, setExpandedRewardId] = useState<string | null>(null)

  useEffect(() => {
    setDraftRules(toDraftRules(rules))
    setSaveError(null)
  }, [rules])

  const cleanDraftRules = useMemo(() => cleanRulesForSave(draftRules), [draftRules])
  const isDirty = useMemo(
    () => JSON.stringify(cleanDraftRules) !== JSON.stringify(cleanRulesForSave(rules)),
    [cleanDraftRules, rules],
  )

  const rewardValidation = useMemo(() => {
    const errors: string[] = []
    const seen = new Map<number, number>()

    if (!draftRules.rewardLadder.length) {
      errors.push("Agrega al menos un premio.")
      return errors
    }

    draftRules.rewardLadder.forEach((reward, index) => {
      const label = reward.title?.trim() || `Premio ${index + 1}`
      const threshold = Number(reward.threshold)
      const expiry = Number(reward.expiresInDays)

      if (!reward.title?.trim()) errors.push(`${label}: falta nombre.`)
      if (!reward.subtitle?.trim()) errors.push(`${label}: falta descripción.`)
      if (!Number.isFinite(threshold) || threshold <= 0) errors.push(`${label}: puntos inválidos.`)
      if (!Number.isFinite(expiry) || expiry <= 0) errors.push(`${label}: validez inválida.`)

      if (Number.isFinite(threshold)) {
        seen.set(threshold, (seen.get(threshold) ?? 0) + 1)
      }

      if (reward.kind === "percent") {
        const value = Number(reward.value)
        if (!Number.isFinite(value) || value <= 0 || value > 100) {
          errors.push(`${label}: descuento inválido.`)
        }
      }

      if (reward.kind === "free-item" || reward.kind === "combo") {
        const cap = Number(reward.capUsd)
        if (!Number.isFinite(cap) || cap <= 0) {
          errors.push(`${label}: monto inválido.`)
        }
      }
    })

    Array.from(seen.entries())
      .filter(([, count]) => count > 1)
      .forEach(([threshold]) => errors.push(`Puntos duplicados: ${threshold}.`))

    return errors
  }, [draftRules.rewardLadder])

  const levelWarnings = useMemo(() => {
    const warnings: string[] = []
    const ladder = draftRules.levelLadder ?? []
    if (!ladder.length) {
      warnings.push("No hay niveles configurados.")
      return warnings
    }
    let outOfOrder = false
    let last = -Infinity
    ladder.forEach((level) => {
      if (level.minPoints < last) outOfOrder = true
      last = level.minPoints
    })
    if (outOfOrder) warnings.push("Los niveles no están ordenados.")
    return warnings
  }, [draftRules.levelLadder])

  const displayedRewards = useMemo(
    () => [...draftRules.rewardLadder].sort((a, b) => Number(a.threshold) - Number(b.threshold)),
    [draftRules.rewardLadder],
  )

  const rewardStats = useMemo(() => {
    const ladder = draftRules.rewardLadder ?? []
    const sorted = [...ladder].sort((a, b) => Number(a.threshold) - Number(b.threshold))
    const min = sorted[0]?.threshold ?? 0
    const max = sorted[sorted.length - 1]?.threshold ?? 0
    return { count: ladder.length, min, max }
  }, [draftRules.rewardLadder])

  const updateRuleField = (field: keyof LoyaltyRulesResponse, rawValue: string) => {
    const value = readNumber(rawValue)
    setDraftRules((prev) => {
      const next = { ...prev, [field]: value ?? 0 }
      if (field === "levelMonthlyCouponExpiryDays" || field === "levelMonthlyCouponRenewDay") {
        return applyLevelGlobals(next) as DraftRules
      }
      return next
    })
  }

  const updateReward = (id: string, patch: Partial<RewardDefinition>) => {
    setDraftRules((prev) => ({
      ...prev,
      rewardLadder: prev.rewardLadder.map((reward) =>
        reward._uiId === id ? { ...reward, ...patch } : reward,
      ),
    }))
  }

  const updateRewardKind = (id: string, kind: RewardKind) => {
    setDraftRules((prev) => ({
      ...prev,
      rewardLadder: prev.rewardLadder.map((reward) => {
        if (reward._uiId !== id) return reward
        const next: DraftReward = { ...reward, kind }
        if (kind === "percent") {
          next.value = Number.isFinite(Number(reward.value)) ? Number(reward.value) : 10
          delete next.capUsd
        } else if (kind === "bogo") {
          delete next.value
          delete next.capUsd
        } else {
          next.capUsd = Number.isFinite(Number(reward.capUsd)) ? Number(reward.capUsd) : 5
          delete next.value
        }
        return next
      }),
    }))
  }

  const getNewReward = (prev: DraftRules, threshold: number): DraftReward => ({
    _uiId: createRewardUiId(),
    _isNew: true,
    threshold,
    title: "Nuevo premio",
    subtitle: "Define el beneficio",
    kind: "percent",
    value: 10,
    expiresInDays: Number(prev.couponExpiryDays ?? 0) || 30,
  })

  const addReward = () => {
    const id = createRewardUiId()
    setDraftRules((prev) => {
      const step = Number(prev.thresholdStep ?? 0) || 5
      const start = Number(prev.firstThreshold ?? 0) || step
      const sorted = [...prev.rewardLadder].sort((a, b) => Number(a.threshold) - Number(b.threshold))
      const last = sorted[sorted.length - 1]
      const nextThreshold = last ? Number(last.threshold) + step : start
      return {
        ...prev,
        rewardLadder: [...prev.rewardLadder, { ...getNewReward(prev, nextThreshold), _uiId: id }],
      }
    })
    setExpandedRewardId(id)
  }

  const insertReward = (targetId: string) => {
    const id = createRewardUiId()
    setDraftRules((prev) => {
      const ladder = [...prev.rewardLadder].sort((a, b) => Number(a.threshold) - Number(b.threshold))
      const index = ladder.findIndex((reward) => reward._uiId === targetId)
      const insertAt = index >= 0 ? index + 1 : ladder.length
      const currentReward = ladder[index]
      const nextReward = ladder[insertAt]
      const step = Number(prev.thresholdStep ?? 0) || 5
      const currentPoints = currentReward ? Number(currentReward.threshold) : Number(prev.firstThreshold ?? 0) || step
      const nextPoints = nextReward ? Number(nextReward.threshold) : currentPoints + step
      const midPoints = Math.floor((currentPoints + nextPoints) / 2)
      const threshold = midPoints > currentPoints ? midPoints : currentPoints + step

      ladder.splice(insertAt, 0, { ...getNewReward(prev, threshold), _uiId: id })
      return { ...prev, rewardLadder: ladder }
    })
    setExpandedRewardId(id)
  }

  const duplicateReward = (id: string) => {
    const copyId = createRewardUiId()
    setDraftRules((prev) => {
      const ladder = [...prev.rewardLadder]
      const index = ladder.findIndex((reward) => reward._uiId === id)
      const original = ladder[index]
      if (!original) return prev
      const copy: DraftReward = {
        ...original,
        _uiId: copyId,
        _isNew: true,
        threshold: Number(original.threshold) + (Number(prev.thresholdStep ?? 0) || 5),
      }
      ladder.splice(index + 1, 0, copy)
      return { ...prev, rewardLadder: ladder }
    })
    setExpandedRewardId(copyId)
  }

  const removeReward = (id: string) => {
    setDraftRules((prev) => ({
      ...prev,
      rewardLadder: prev.rewardLadder.filter((reward) => reward._uiId !== id),
    }))
    if (expandedRewardId === id) setExpandedRewardId(null)
  }

  const updateLevel = (index: number, patch: Partial<LevelDefinition>) => {
    setDraftRules((prev) => {
      const ladder = prev.levelLadder
      if (!ladder) return prev
      return {
        ...prev,
        levelLadder: ladder.map((level, idx) =>
          idx === index ? { ...level, ...patch } : level,
        ),
      }
    })
  }

  const updateMonthlyCoupon = (levelIndex: number, couponIndex: number, patch: Partial<LevelMonthlyCoupon>) => {
    setDraftRules((prev) => {
      const ladder = prev.levelLadder
      if (!ladder) return prev
      const nextLadder = [...ladder]
      const level = nextLadder[levelIndex]
      if (!level) return prev
      const packs = [...(level.perks?.monthlyCoupons ?? [])]
      packs[couponIndex] = { ...packs[couponIndex], ...patch }
      nextLadder[levelIndex] = {
        ...level,
        perks: { ...level.perks, monthlyCoupons: packs },
      }
      return { ...prev, levelLadder: nextLadder }
    })
  }

  const addMonthlyCoupon = (levelIndex: number) => {
    setDraftRules((prev) => {
      const ladder = prev.levelLadder
      if (!ladder) return prev
      const nextLadder = [...ladder]
      const level = nextLadder[levelIndex]
      if (!level) return prev
      const packs = [...(level.perks?.monthlyCoupons ?? [])]
      packs.push({ percent: 10, quantity: 1 })
      nextLadder[levelIndex] = {
        ...level,
        perks: { ...level.perks, monthlyCoupons: packs },
      }
      return { ...prev, levelLadder: nextLadder }
    })
  }

  const removeMonthlyCoupon = (levelIndex: number, couponIndex: number) => {
    setDraftRules((prev) => {
      const ladder = prev.levelLadder
      if (!ladder) return prev
      const nextLadder = [...ladder]
      const level = nextLadder[levelIndex]
      if (!level) return prev
      const packs = (level.perks?.monthlyCoupons ?? []).filter((_, idx) => idx !== couponIndex)
      nextLadder[levelIndex] = {
        ...level,
        perks: { ...level.perks, monthlyCoupons: packs },
      }
      return { ...prev, levelLadder: nextLadder }
    })
  }

  const sortLevels = () => {
    setDraftRules((prev) => {
      if (!prev.levelLadder) return prev
      return {
        ...prev,
        levelLadder: [...prev.levelLadder].sort((a, b) => a.minPoints - b.minPoints),
      }
    })
  }

  const applyLevelGlobalsToAll = () => {
    setDraftRules((prev) => applyLevelGlobals(prev) as DraftRules)
  }

  const handleSave = async () => {
    if (rewardValidation.length) {
      setSaveError(rewardValidation[0])
      setActiveTab("points")
      return
    }

    const synced = applyLevelGlobals(cleanDraftRules)
    setSaveError(null)
    setSaving(true)
    try {
      const saved = await onSaveRules(synced)
      setDraftRules(toDraftRules(saved || synced))
      setStatus("Cambios guardados")
      setTimeout(() => setStatus(null), 2000)
    } catch (error: any) {
      const message = error?.message || "No se pudo guardar"
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraftRules(toDraftRules(rules))
    setSaveError(null)
    setExpandedRewardId(null)
  }

  const canSave = isDirty && !saving && rewardValidation.length === 0
  const validationItems = rewardValidation.concat(levelWarnings)
  const rewardSummary = rewardStats.count > 0
    ? `${rewardStats.count} premios · ${rewardStats.min}-${rewardStats.max} pts`
    : "Sin premios"

  return (
    <div className="mx-auto -mt-4 max-w-[1120px] px-0 pb-20 sm:-mt-6">
      <div className="sticky top-[60px] z-30 -mx-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60 lg:mx-0 lg:rounded-b-3xl lg:border-x lg:px-5">
        <div className="grid gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                <Gift size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-slate-900">Premios</h2>
                <p className="text-sm font-bold text-slate-500">{rewardSummary}</p>
              </div>
            </div>
            {validationItems.length > 0 && (
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="truncate">{validationItems[0]}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-bold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={16} />
              Descartar
            </button>
            <button
              type="button"
              onClick={addReward}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus size={17} />
              Nuevo
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-2 text-sm font-bold text-white shadow-sm shadow-slate-700/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
            >
              <Save size={16} />
              {saving ? "Guardando" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertTriangle size={16} />
          {saveError}
        </div>
      )}

      <div className="mt-6 px-4 lg:px-0">
        <div className="min-w-0 space-y-5">
          <div className="flex justify-center">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/70">
            {(["points", "levels", "rules"] as const).map((tab) => {
              const isActive = activeTab === tab
              const Icon = tab === "points" ? Ticket : tab === "levels" ? Trophy : Settings2
              const label = tab === "points" ? "Premios" : tab === "levels" ? "Niveles" : "Reglas"
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              )
            })}
          </div>
          </div>

          {activeTab === "points" && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {displayedRewards.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <Gift className="mb-3 text-slate-300" size={44} />
                  <p className="text-base font-black text-slate-900">Sin premios</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">Crea el primer beneficio.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                  {displayedRewards.map((reward, visibleIndex) => {
                    const rewardId = reward._uiId ?? ""
                    const isExpanded = expandedRewardId === rewardId
                    const isPercent = reward.kind === "percent"
                    const needsAmount = reward.kind === "free-item" || reward.kind === "combo"
                    const invalid =
                      !reward.title?.trim() ||
                      !reward.subtitle?.trim() ||
                      !Number.isFinite(Number(reward.threshold)) ||
                      Number(reward.threshold) <= 0 ||
                      !Number.isFinite(Number(reward.expiresInDays)) ||
                      Number(reward.expiresInDays) <= 0 ||
                      (isPercent && (!Number.isFinite(Number(reward.value)) || Number(reward.value) <= 0 || Number(reward.value) > 100)) ||
                      (needsAmount && (!Number.isFinite(Number(reward.capUsd)) || Number(reward.capUsd) <= 0))

                    return (
                      <article
                        key={rewardId}
                        className={`relative overflow-visible transition ${isExpanded ? "bg-slate-50" : "hover:bg-slate-50/70"}`}
                      >
                        {visibleIndex < displayedRewards.length - 1 && (
                          <div className="pointer-events-none absolute left-[23px] top-10 z-0 h-full w-0.5 bg-slate-300" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedRewardId(isExpanded ? null : rewardId)}
                          className="relative z-10 grid w-full grid-cols-[48px_1fr] gap-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300"
                        >
                          <div className="relative flex justify-center pt-4">
                            <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white shadow-sm shadow-blue-600/20">
                              <CheckCircle2 size={15} strokeWidth={3} />
                            </div>
                          </div>
                          <div className={`min-w-0 border-b border-slate-200 py-4 pr-3 sm:pr-4 ${visibleIndex === displayedRewards.length - 1 ? "border-b-0" : ""}`}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <h3 className="truncate text-sm font-black text-slate-900">
                                    {reward.title || "Sin nombre"}
                                  </h3>
                                  {reward._isNew && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                                      Nuevo
                                    </span>
                                  )}
                                  {invalid && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
                                      Revisar
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 truncate text-xs font-semibold leading-snug text-slate-500">
                                  {reward.subtitle || getRewardKindLabel(reward.kind)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                                  {reward.threshold} pts
                                </span>
                                <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                  {reward.expiresInDays} días
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="relative z-20 mx-3 mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/80">
                            <div className="grid gap-2">
                              <label className="space-y-1">
                                <span className={compactLabelBase}>Nombre</span>
                                <div className="relative">
                                  <Tag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <input
                                    value={reward.title ?? ""}
                                    onChange={(event) => updateReward(rewardId, { title: event.target.value })}
                                    className={`${compactInputBase} pl-9`}
                                    placeholder="Producto gratis"
                                  />
                                </div>
                              </label>
                              <label className="space-y-1">
                                <span className={compactLabelBase}>Descripción</span>
                                <div className="relative">
                                  <FileText className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <input
                                    value={reward.subtitle ?? ""}
                                    onChange={(event) => updateReward(rewardId, { subtitle: event.target.value })}
                                    className={`${compactInputBase} pl-9`}
                                    placeholder="Aplicable a una compra"
                                  />
                                </div>
                              </label>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                              <label className="col-span-2 space-y-1 sm:col-span-1">
                                <span className={compactLabelBase}>Tipo</span>
                                <div className="relative">
                                  <Shapes className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <select
                                    value={reward.kind}
                                    onChange={(event) => updateRewardKind(rewardId, event.target.value as RewardKind)}
                                    className={`${compactInputBase} appearance-none pl-9 pr-9`}
                                  >
                                    {rewardKindOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                </div>
                              </label>
                              <label className="space-y-1">
                                <span className={compactLabelBase}>{isPercent ? "Porcentaje" : reward.kind === "bogo" ? "Valor" : "Monto"}</span>
                                <div className="relative">
                                  <Gift className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <input
                                    type="number"
                                    value={isPercent ? (reward.value ?? "") : reward.kind === "bogo" ? "" : (reward.capUsd ?? "")}
                                    disabled={reward.kind === "bogo"}
                                    onChange={(event) => updateReward(rewardId, isPercent
                                      ? { value: readNumber(event.target.value) ?? undefined }
                                      : { capUsd: readNumber(event.target.value) ?? undefined })}
                                    className={`${compactInputBase} pl-9 disabled:bg-slate-50 disabled:text-slate-400`}
                                    placeholder={reward.kind === "bogo" ? "2x1" : "10"}
                                  />
                                  {isPercent && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>}
                                </div>
                              </label>
                              <label className="space-y-1">
                                <span className={compactLabelBase}>Puntos</span>
                                <div className="relative">
                                  <Hash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <input
                                    type="number"
                                    value={reward.threshold}
                                    onChange={(event) => updateReward(rewardId, { threshold: readNumber(event.target.value) ?? 0 })}
                                    className={`${compactInputBase} pl-9`}
                                  />
                                </div>
                              </label>
                              <label className="space-y-1">
                                <span className={compactLabelBase}>Validez</span>
                                <div className="relative">
                                  <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                  <input
                                    type="number"
                                    value={reward.expiresInDays ?? 0}
                                    onChange={(event) => updateReward(rewardId, { expiresInDays: readNumber(event.target.value) ?? 0 })}
                                    className={`${compactInputBase} pl-9 pr-12`}
                                  />
                                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">días</span>
                                </div>
                              </label>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                              <button
                                type="button"
                                onClick={() => insertReward(rewardId)}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                              >
                                <Plus size={15} />
                                Insertar después
                              </button>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => duplicateReward(rewardId)}
                                  className={iconButtonBase}
                                  title="Duplicar"
                                  aria-label="Duplicar premio"
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeReward(rewardId)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50"
                                  title="Eliminar"
                                  aria-label="Eliminar premio"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === "levels" && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sortLevels}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowUpDown size={16} />
                  Ordenar
                </button>
                <button
                  type="button"
                  onClick={applyLevelGlobalsToAll}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Globe size={16} />
                  Aplicar globales
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {(draftRules.levelLadder ?? []).map((level, index) => {
                  const packs = level.perks?.monthlyCoupons ?? []

                  return (
                    <article key={level.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <label className="space-y-1.5">
                          <span className={labelBase}>Nivel {index + 1}</span>
                          <input
                            value={level.name ?? ""}
                            onChange={(event) => updateLevel(index, { name: event.target.value })}
                            className={inputBase}
                            placeholder="Nombre del nivel"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className={labelBase}>Puntos</span>
                          <input
                            type="number"
                            value={level.minPoints ?? 0}
                            onChange={(event) => updateLevel(index, { minPoints: readNumber(event.target.value) ?? 0 })}
                            className={inputBase}
                          />
                        </label>
                      </div>

                      <label className="mt-3 block space-y-1.5">
                        <span className={labelBase}>Descripción</span>
                        <textarea
                          value={level.description ?? ""}
                          onChange={(event) => updateLevel(index, { description: event.target.value })}
                          className={`${inputBase} min-h-[80px] resize-none`}
                          placeholder="Descripción breve"
                        />
                      </label>

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-900">Beneficios mensuales</h4>
                          <button
                            type="button"
                            onClick={() => addMonthlyCoupon(index)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                          >
                            <Plus size={14} />
                            Agregar
                          </button>
                        </div>

                        <div className="space-y-2">
                          {packs.length === 0 ? (
                            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-400">
                              Sin beneficios configurados.
                            </p>
                          ) : (
                            packs.map((pack, packIndex) => (
                              <div key={packIndex} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                <label className="space-y-1">
                                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Descuento</span>
                                  <input
                                    type="number"
                                    value={pack.percent ?? 0}
                                    onChange={(event) => updateMonthlyCoupon(index, packIndex, { percent: readNumber(event.target.value) ?? 0 })}
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold outline-none focus:border-slate-900"
                                  />
                                </label>
                                <label className="space-y-1">
                                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Cantidad</span>
                                  <input
                                    type="number"
                                    value={pack.quantity ?? 0}
                                    onChange={(event) => updateMonthlyCoupon(index, packIndex, { quantity: readNumber(event.target.value) ?? 0 })}
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold outline-none focus:border-slate-900"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeMonthlyCoupon(index, packIndex)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                                  aria-label="Eliminar beneficio"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {activeTab === "rules" && (
            <section className="grid max-w-4xl gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Ticket className="text-slate-500" size={18} />
                  <h3 className="text-lg font-black text-slate-950">Puntos</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className={labelBase}>Por producto</span>
                    <input type="number" value={draftRules.pointsPerProduct ?? 0} onChange={(event) => updateRuleField("pointsPerProduct", event.target.value)} className={inputBase} />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelBase}>Primer premio</span>
                    <input type="number" value={draftRules.firstThreshold ?? 0} onChange={(event) => updateRuleField("firstThreshold", event.target.value)} className={inputBase} />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelBase}>Escalón</span>
                    <input type="number" value={draftRules.thresholdStep ?? 0} onChange={(event) => updateRuleField("thresholdStep", event.target.value)} className={inputBase} />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Clock className="text-slate-500" size={18} />
                  <h3 className="text-lg font-black text-slate-950">Tiempos</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1.5">
                    <span className={labelBase}>Premios</span>
                    <input type="number" value={draftRules.couponExpiryDays ?? 0} onChange={(event) => updateRuleField("couponExpiryDays", event.target.value)} className={inputBase} />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelBase}>Ventana nivel</span>
                    <input type="number" value={draftRules.levelWindowDays ?? 0} onChange={(event) => updateRuleField("levelWindowDays", event.target.value)} className={inputBase} />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelBase}>Cupón nivel</span>
                    <input type="number" value={draftRules.levelMonthlyCouponExpiryDays ?? 0} onChange={(event) => updateRuleField("levelMonthlyCouponExpiryDays", event.target.value)} className={inputBase} />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelBase}>Renovación</span>
                    <input type="number" value={draftRules.levelMonthlyCouponRenewDay ?? 0} onChange={(event) => updateRuleField("levelMonthlyCouponRenewDay", event.target.value)} className={inputBase} min={1} max={31} />
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>

      </div>

      {status && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">
            <CheckCircle2 size={17} className="text-emerald-300" />
            {status}
          </div>
        </div>
      )}
    </div>
  )
}
