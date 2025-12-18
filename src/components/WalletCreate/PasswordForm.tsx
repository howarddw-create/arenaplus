import React, { useState } from 'react'

interface PasswordFormProps {
  password: string;
  setPassword: (password: string) => void;
  onSubmit: () => void;
  loading: boolean;
  isCreate?: boolean;
}

export const PasswordForm: React.FC<PasswordFormProps> = ({
  password,
  setPassword,
  onSubmit,
  loading,
  isCreate = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
        >
          {isCreate ? 'Set Password' : 'Enter Password'}
        </label>
        <div
          className={`relative rounded-xl border bg-white/90 transition shadow-sm ${
            focused
              ? 'border-transparent ring-2 ring-blue-400/60'
              : 'border-slate-200'
          }`}
        >
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isCreate ? 'Set a secure password' : 'Enter your password'}
            className="w-full rounded-xl border-0 bg-transparent p-3 pr-12 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            autoComplete="new-password"
            autoFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transform text-slate-400 transition hover:text-slate-600"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
        {isCreate && (
          <p className="mt-2 text-xs text-slate-400">
            Create a strong password to secure your wallet
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!password.trim() || loading}
        className="gradient-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-80"
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : isCreate ? 'Create Wallet' : 'Unlock Wallet'}
      </button>      
    </form>
  )
}