import { Fragment, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { moveSlot, noDrawMonths, projectedShortfall, scheduleOrder, shuffleUnpaid, type DrawShare, type DrawSlot } from '../../lib/calc'
import { outcomeMessage, voidRow } from '../../lib/ledgerWrites'
import { Modal } from '../ui/Modal'
import { formatDate, formatMoney, formatShortDate, periodLabel, plural } from '../../lib/format'
import type { Member, Payout } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { VoidDialog } from './VoidDialog'
import { Avatar, type PartnerCtx } from './shared'
import { useLast } from '../../hooks/usePresence'

export function DrawsTab({ ctx, onPay }: { ctx: PartnerCtx; onPay: (share: DrawShare) => void }) {
  const { partner, members, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState<Payout | null>(null)
  const [moving, setMoving] = useState<number | null>(null)
  const { schedule, terms } = summary
  const memberById = new Map(members.map((m) => [m.id, m]))
  const shortfall = useMemo(() => projectedShortfall(partner, members), [partner, members])

  if (schedule.length === 0) {
    return (
      <EmptyState icon="gift" title="No draws yet">
        Each hand gets one draw; two half hands share one. Add members and the draw order appears here.
      </EmptyState>
    )
  }

  async function saveOrder(order: string[], message: string): Promise<boolean> {
    setSaving(true)
    const { error } = await supabase.from('partners').update({ draw_order: order }).eq('id', partner.id)
    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return false
    }
    refresh()
    toast(message)
    return true
  }

  const order = scheduleOrder(schedule)
  const canSwap = (a: number, b: number) => b >= 0 && b < schedule.length && !schedule[a].locked && !schedule[b].locked

  async function shuffle() {
    const ok = await confirm({
      title: 'Draw lots?',
      message: 'Randomly re-orders every draw that hasn’t been paid out yet. Draws already paid stay where they are; half hands keep their partner.',
      confirmLabel: 'Shuffle',
    })
    if (ok) saveOrder(shuffleUnpaid(schedule), 'Draw order shuffled')
  }

  async function voidPayout(reason: string): Promise<boolean> {
    if (!voiding) return false
    const done = voidRow('payouts', voiding.id, reason, `Void of ${formatMoney(voiding.net)} payout`)
    toast('Payout voided', 'info')
    void done.then((o) => {
      const msg = outcomeMessage(o)
      if (msg) toast(msg.text, msg.tone)
    })
    return true
  }

  const skipped = noDrawMonths(partner)
  const perMonth = schedule.length / (partner.term_months - skipped.length)
  // Every month in the cycle without a draw — chosen, or left by spreading
  // fewer draws over more months — shown in its place in the list.
  const drawn = new Set(schedule.map((s) => s.period))
  const gaps = Array.from({ length: partner.term_months }, (_, i) => i + 1).filter((m) => !drawn.has(m))
  const gapsBefore = (i: number) => gaps.filter((m) => m < schedule[i].period && (i === 0 || m > schedule[i - 1].period))
  const gapsAfterLast = gaps.filter((m) => m > schedule[schedule.length - 1].period)

  const paidCount = schedule.filter((x) => x.done).length

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="eyebrow">Each draw</p>
          <p className="mono mt-0.5 text-lg font-semibold text-ink-900">
            {formatMoney(terms.netPerDraw)}
            {terms.feePerDraw > 0 && (
              <span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-ink-400">
                {formatMoney(terms.grossPerDraw)} − {formatMoney(terms.feePerDraw)} fee
              </span>
            )}
          </p>
          <p className="num text-xs text-ink-500">
            {paidCount} of {plural(schedule.length, 'draw')} paid
            {perMonth !== 1 && (
              <> · {Number.isInteger(perMonth) ? `${perMonth} a month` : `over ${plural(partner.term_months - skipped.length, 'month')}`}</>
            )}
            {gaps.length > 0 && <> · {plural(gaps.length, 'month')} with no draw</>}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={shuffle} loading={saving} disabled={schedule.every((s) => s.locked)}>
          <Icon name="shuffle" size={15} /> Draw lots
        </Button>
      </div>

      {shortfall && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200/70">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          <span>
            Even if everyone pays on time, the pot is short for the month {shortfall.period} draw (up to{' '}
            <strong className="num">{formatMoney(shortfall.short)}</strong>). Move a no-draw month earlier in partner settings, or plan to
            front it.
          </span>
        </p>
      )}

      <ol className="card stagger divide-y divide-line-soft overflow-hidden">
        {schedule.map((slot, i) => {
          const isNow = !slot.done && slot.period === summary.rawPeriod
          const overdue = !slot.done && slot.period < summary.rawPeriod
          const [mon, yr] = periodLabel(partner.start_date, slot.period).split(' ')
          const who = slot.shares.map((s) => memberById.get(s.memberId)?.name ?? 'member').join(' & ')
          return (
            <Fragment key={slot.index}>
              {gapsBefore(i).map((m) => (
                <NoDrawRow key={`gap-${m}`} startDate={partner.start_date} period={m} chosen={skipped.includes(m)} />
              ))}
              <li
                style={{ ['--i' as string]: i }}
                className={`relative flex items-center gap-3 px-3 py-3.5 transition-colors sm:px-4 ${isNow ? 'bg-gradient-to-r from-accent-500/10 to-transparent' : overdue ? 'bg-rose-50/40' : ''}`}
              >
                {(isNow || overdue) && <span className={`absolute inset-y-0 left-0 w-1 ${overdue ? 'bg-rose-500' : 'bg-accent-600'}`} aria-hidden />}
                <button
                  type="button"
                  disabled={slot.locked || saving}
                  onClick={() => setMoving(i)}
                  aria-label={
                    slot.locked
                      ? `Month ${slot.period}, ${mon} ${yr}: ${who} — ${slot.done ? 'paid' : 'part paid'}, locked`
                      : `Month ${slot.period}, ${mon} ${yr}: move ${who}’s draw`
                  }
                  title={slot.locked ? 'Paid draws are locked' : 'Move this draw'}
                  className={`flex w-12 shrink-0 flex-col items-center self-start rounded-2xl py-1.5 text-center ring-1 ring-inset tap focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 ${
                    slot.done
                      ? 'bg-brand-50 text-brand-700 ring-brand-600/15'
                      : isNow
                        ? 'bg-surface text-accent-700 ring-accent-500/40 hover:ring-accent-500/70'
                        : 'bg-ink-50 text-ink-600 ring-line hover:ring-ink-300'
                  }`}
                >
                  {/* The cycle month number, with the calendar month under it ("3" alone over "Mar" reads like a date). */}
                  <span className="text-[9.5px] font-medium opacity-60">Month</span>
                  <span className="mono text-base font-semibold leading-tight">{slot.period}</span>
                  <span className="whitespace-nowrap text-[9.5px] font-semibold opacity-70">
                    {mon} ’{yr.slice(-2)}
                  </span>
                </button>
                <div className="min-w-0 flex-1 space-y-2.5">
                  {slot.shares.map((share) => (
                    <ShareRow
                      key={share.memberId}
                      share={share}
                      member={memberById.get(share.memberId)}
                      lone={slot.half && slot.shares.length === 1}
                      status={overdue ? 'overdue' : isNow ? 'now' : null}
                      onPay={() => onPay(share)}
                      onVoid={() => share.payout && setVoiding(share.payout)}
                    />
                  ))}
                </div>
                {!slot.locked ? (
                  <div className="flex flex-col self-center">
                    <ReorderButtons
                      who={who}
                      up={canSwap(i, i - 1) ? () => saveOrder(moveSlot(order, i, i - 1), 'Order updated') : undefined}
                      down={canSwap(i, i + 1) ? () => saveOrder(moveSlot(order, i, i + 1), 'Order updated') : undefined}
                      disabled={saving}
                    />
                  </div>
                ) : (
                  <span className="flex w-7 justify-center self-center text-ink-300" title="Paid draws are locked">
                    <Icon name="lock" size={13} />
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
        {gapsAfterLast.map((m) => (
          <NoDrawRow key={`gap-${m}`} startDate={partner.start_date} period={m} chosen={skipped.includes(m)} />
        ))}
      </ol>
      <p className="px-4 text-center text-xs leading-relaxed text-ink-400">
        Tap a month to move that draw anywhere, or use the arrows to swap neighbours. Paid draws are locked. Two half hands share one
        draw and move together.
      </p>

      <MoveDrawModal
        slots={schedule}
        from={moving}
        startDate={partner.start_date}
        names={memberById}
        saving={saving}
        onClose={() => setMoving(null)}
        onMove={async (to) => {
          if (moving === null) return
          // Stays open if the save fails, so the move can be tried again.
          if (await saveOrder(moveSlot(order, moving, to), 'Draw moved')) setMoving(null)
        }}
      />

      <VoidDialog open={!!voiding} title="Void this payout?" confirmLabel="Void payout" onClose={() => setVoiding(null)} onConfirm={voidPayout}>
        {voiding && (
          <>
            The record of {formatMoney(voiding.net)} paid to {memberById.get(voiding.member_id)?.name ?? 'this member'} on{' '}
            {formatDate(voiding.paid_on)} stops counting, and the draw opens again.
          </>
        )}
      </VoidDialog>
    </div>
  )
}

/** A month where everyone pays and nobody draws. */
function NoDrawRow({ startDate, period, chosen }: { startDate: string; period: number; chosen: boolean }) {
  const [mon, yr] = periodLabel(startDate, period).split(' ')
  return (
    <li className="flex items-center gap-3 bg-ink-50/50 px-3 py-2.5 sm:px-4">
      <span className="flex w-12 shrink-0 flex-col items-center text-center text-ink-400">
        <span className="mono text-sm font-semibold leading-tight">{period}</span>
        <span className="whitespace-nowrap text-[9.5px] font-semibold">
          {mon} ’{yr.slice(-2)}
        </span>
      </span>
      <p className="min-w-0 flex-1 text-xs text-ink-500">
        <span className="font-semibold text-ink-600">No draw</span> · everyone still pays{chosen ? '' : ' (draws are spread over the cycle)'}
      </p>
    </li>
  )
}

function ShareRow({
  share,
  member,
  lone,
  status,
  onPay,
  onVoid,
}: {
  share: DrawShare
  member: Member | undefined
  lone: boolean
  status: 'overdue' | 'now' | null
  onPay: () => void
  onVoid: () => void
}) {
  if (!member) return null
  const multi = Number(member.hands) > 1
  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:block">
        <Avatar name={member.name} id={member.id} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[14.5px] font-semibold text-ink-900">
          <span className="truncate">{member.name}</span>
          {multi && !share.half && <span className="shrink-0 text-xs font-medium text-ink-400">hand {share.handNo}</span>}
        </p>
        <p className="text-xs text-ink-500">
          {share.payout ? (
            <span className="num inline-flex items-center gap-1 font-semibold text-brand-700">
              <Icon name="check" size={12} className="tick" /> {formatMoney(share.payout.net)} · {formatShortDate(share.payout.paid_on)}
            </span>
          ) : (
            <>
              <span className="num">{formatMoney(share.net)}</span>
              {share.half && <span className="font-semibold text-sky-700"> · ½ hand</span>}
              {status === 'overdue' && <span className="font-semibold text-rose-600"> · overdue</span>}
              {status === 'now' && <span className="font-semibold text-accent-700"> · this month</span>}
              {lone && <span className="text-ink-400"> · no partner yet</span>}
            </>
          )}
        </p>
      </div>
      {share.payout ? (
        <IconButton label={`Void ${member.name}’s payout`} onClick={onVoid} plain className="hover:bg-rose-50 hover:text-rose-600">
          <Icon name="undo" size={16} />
        </IconButton>
      ) : (
        <Button size="sm" variant={status ? 'accent' : 'secondary'} onClick={onPay} aria-label={`Pay out ${member.name} (${formatMoney(share.net)})`}>
          Pay
        </Button>
      )}
    </div>
  )
}

function ReorderButtons({ who, up, down, disabled }: { who: string; up?: () => void; down?: () => void; disabled: boolean }) {
  const cls =
    'flex h-6 w-7 items-center justify-center rounded-lg text-ink-400 tap hover:bg-fill hover:text-ink-800 disabled:pointer-events-none disabled:opacity-20'
  return (
    <>
      <button type="button" aria-label={`Move ${who} earlier`} title="Move earlier" onClick={up} disabled={!up || disabled} className={cls}>
        <Icon name="arrow-up" size={15} />
      </button>
      <button type="button" aria-label={`Move ${who} later`} title="Move later" onClick={down} disabled={!down || disabled} className={cls}>
        <Icon name="arrow-down" size={15} />
      </button>
    </>
  )
}

/** Pick where a draw should go; the draws in between shift by one. Paid draws can't be jumped onto. */
function MoveDrawModal({
  slots,
  from,
  startDate,
  names,
  saving,
  onClose,
  onMove,
}: {
  slots: DrawSlot[]
  from: number | null
  startDate: string
  names: Map<string, Member>
  saving: boolean
  onClose: () => void
  onMove: (to: number) => void
}) {
  const shownFrom = useLast(from)
  if (shownFrom === null || !slots[shownFrom]) return null
  const who = (s: DrawSlot) => s.shares.map((x) => names.get(x.memberId)?.name ?? '—').join(' & ')
  // Moving across a paid draw would shift it, so only the open stretch around this draw is offered.
  let lo = shownFrom
  while (lo > 0 && !slots[lo - 1].locked) lo--
  let hi = shownFrom
  while (hi < slots.length - 1 && !slots[hi + 1].locked) hi++
  return (
    <Modal open={from !== null} onClose={onClose} title="Move draw" subtitle={who(slots[shownFrom])}>
      {lo === hi && (
        <p className="mb-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">Paid draws on both sides — there’s nowhere to move this one.</p>
      )}
      <ol className="divide-y divide-line-soft rounded-2xl pb-2 ring-1 ring-inset ring-line">
        {slots.map((s, i) => {
          const allowed = i >= lo && i <= hi && i !== shownFrom
          return (
            <li key={s.index}>
              <button
                type="button"
                disabled={!allowed || saving}
                onClick={() => onMove(i)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                  i === shownFrom ? 'bg-accent-500/10' : allowed ? 'hover:bg-ink-50 active:bg-ink-100' : 'opacity-45'
                }`}
              >
                <span className="num w-20 shrink-0 font-semibold text-ink-800">{periodLabel(startDate, s.period)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-600">{who(s)}</span>
                {s.locked ? (
                  <Icon name="lock" size={13} className="shrink-0 text-ink-300" />
                ) : i === shownFrom ? (
                  <span className="shrink-0 text-xs font-semibold text-accent-700">Here now</span>
                ) : allowed ? (
                  <span className="shrink-0 text-xs font-semibold text-ink-900 underline underline-offset-[3px]">Move here</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
