import React from 'react';

interface FormFieldProps {
  label: string;
  id: string;
  value: string;
  setValue: (value: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  placeholder: string;
  type?: string;
  step?: string;
  min?: string;
  buttonLabel: string;
  onButtonClick: () => void;
  helpText?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  value,
  setValue,
  isFocused,
  onFocus,
  onBlur,
  placeholder,
  type = "text",
  step,
  min,
  buttonLabel,
  onButtonClick,
  helpText,
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1">
      {label}
    </label>
    <div
      className={`flex relative border ${
        isFocused
          ? "border-blue-500/70 ring-2 ring-blue-500/30"
          : "border-slate-300"
      } rounded-lg overflow-hidden transition-all duration-200 bg-white`}
    >
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full px-3 py-2.5 focus:outline-none text-slate-800 placeholder:text-slate-400"
      />
      <button
        type="button"
        onClick={onButtonClick}
        className="px-3 m-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        {buttonLabel}
      </button>
    </div>
    {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
  </div>
);
