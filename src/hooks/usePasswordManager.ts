import { useState, useEffect } from "react";
import * as CryptoJS from "crypto-js";

export const usePasswordManager = () => {
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    checkStoredPassword();
  }, []);

  const checkStoredPassword = async () => {
    const data = await chrome.storage.local.get("password");
    setHasStoredPassword(!!data.password);
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    const data = await chrome.storage.local.get("password");
    if (!data.password) return false;

    const inputHash = CryptoJS.SHA256(password).toString();
    return inputHash === data.password;
  };

  const clearTempPassword = async () => {
    setTempPassword(null);
    setHasStoredPassword(false);
  };

  return {
    hasStoredPassword,
    tempPassword,
    checkStoredPassword,
    verifyPassword,
    clearTempPassword,
  };
};
