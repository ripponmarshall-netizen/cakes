import type { CakeItem } from '../../lib/types'
import { formatMoney } from '../../lib/format'

export function CakeCard({
  cake,
  onEdit,
  onDelete,
}: {
  cake: CakeItem
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col rounded-3xl bg-white p-5 shadow-card transition hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-snug text-cocoa-800">{cake.name}</h3>
        <span className="shrink-0 rounded-full bg-blush-100 px-3 py-1 text-sm font-bold text-blush-600">
          {formatMoney(cake.price)}
        </span>
      </div>

      {cake.description && (
        <p className="mt-1.5 text-sm text-cocoa-500">{cake.description}</p>
      )}

      {cake.includes.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {cake.includes.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-cocoa-600">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-blush-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z"
                  clipRule="evenodd"
                />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex gap-2 border-t border-blush-50 pt-4">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg py-1.5 text-sm font-semibold text-cocoa-600 transition hover:bg-blush-50"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded-lg py-1.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
