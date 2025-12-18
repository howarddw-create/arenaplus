import React, { useState } from 'react'
import { SetPasswordForm } from './SetPasswordForm'

interface ImportFormProps {
  privateKey: string;
  setPrivateKey: (key: string) => void;
  onSubmit: (privateKey: string, password: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export const ImportForm: React.FC<ImportFormProps> = ({
  privateKey,
  setPrivateKey,
  onSubmit,
  onCancel,
  loading
}) => {
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const handlePrivateKeySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!privateKey.trim()) return
    setShowPasswordForm(true)
  }

  if (showPasswordForm) {
    return (
      <div className="space-y-4">
        <SetPasswordForm
          onSubmit={(password) => onSubmit(privateKey, password)}
          loading={loading}
        />
        <button
          type="button"
          onClick={() => {
            setShowPasswordForm(false)
            setPrivateKey('')
          }}
          className="w-full py-2 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handlePrivateKeySubmit} className="space-y-3">
      <div>
        <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700 mb-1">
          Enter Private Key
        </label>
        <input
          type="password"
          id="privateKey"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="Enter your private key"
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          autoComplete="off"
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          disabled={loading || !privateKey.trim()}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  )
} 