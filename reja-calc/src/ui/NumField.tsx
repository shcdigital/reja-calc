import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Valor mostrado = value / scale (p. ej. 10 para mostrar cm). */
  scale?: number;
  suffix?: string;
  hint?: string;
  min?: number;
  integer?: boolean;
  id?: string;
}

const show = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** Campo numérico que acepta coma o punto decimal y no pisa lo que se está escribiendo. */
export function NumField({ label, value, onChange, scale = 1, suffix, hint, min, integer, id }: Props) {
  const [text, setText] = useState(show(value / scale));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(show(value / scale));
  }, [value, scale, focused]);

  const invalid = (() => {
    const n = Number(text.replace(',', '.'));
    return text.trim() === '' || !Number.isFinite(n) || (min !== undefined && n < min);
  })();

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className={`field-input${invalid ? ' is-invalid' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setText(show(value / scale)); }}
          onChange={(e) => {
            setText(e.target.value);
            let n = Number(e.target.value.replace(',', '.'));
            if (e.target.value.trim() !== '' && Number.isFinite(n)) {
              if (integer) n = Math.round(n);
              onChange(n * scale);
            }
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
