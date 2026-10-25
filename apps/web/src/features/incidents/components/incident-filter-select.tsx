import { Select } from '@/components/ui/form';

type IncidentFilterSelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
};

export function IncidentFilterSelect({
  label,
  value,
  onChange,
  options,
}: IncidentFilterSelectProps) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <label htmlFor={id} className="grid gap-1 text-[13px] font-semibold">
      {label}
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-auto min-w-[150px] font-normal capitalize"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </Select>
    </label>
  );
}
