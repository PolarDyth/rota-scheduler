interface Props {
  date?: string;
  headcount: number;
}

export function PrintHeader({ date, headcount }: Props) {
  return (
    <div className="print-only mb-1 flex items-baseline justify-between">
      {date && <p className="text-sm font-semibold">{date}</p>}
      <p className="text-xs text-neutral-600">{headcount} employees</p>
    </div>
  );
}
