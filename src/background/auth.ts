// src/background/auth.ts
import { supabase } from '../supabaseClient';

export async function twitterLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: chrome.runtime.getURL('auth-sandbox.html'),
    },
  });

  if (error) {
    console.error('Error during Twitter login:', error);
    throw error;
  }

  if (data.url) {
    chrome.tabs.create({ url: data.url });
  }

  return data;
}

