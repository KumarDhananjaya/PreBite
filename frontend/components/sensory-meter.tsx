export function SensoryMeter({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return <div><div className="mb-2 flex justify-between text-xs"><span className="text-zinc-300">{icon} {label}</span><span className="text-zinc-600">{value}/5</span></div><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((point) => <span key={point} className={`h-2 flex-1 rounded-sm ${point <= value ? color : "bg-zinc-800"}`} />)}</div></div>;
}
