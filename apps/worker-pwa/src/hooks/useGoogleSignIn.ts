import { useEffect, useRef, useCallback } from 'react';

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          prompt: () => void;
        };
        oauth2: {
          initTokenClient: (options: any) => any;
        };
      };
    };
  }
}

interface UseGoogleSignInProps {
  onSuccess: (accessToken: string) => void;
  onError?: (error: any) => void;
  clientId?: string;
}

export const useGoogleSignIn = ({
  onSuccess,
  onError,
  clientId = '831736850065-asmq8g1kj6ht2n3pj2hj0j1sg6cfk5dh.apps.googleusercontent.com' // Default client ID for development
}: UseGoogleSignInProps) => {
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      // Wait for Google script to load
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initializeGoogleSignIn();
        }
      }, 100);

      return () => clearInterval(checkGoogle);
    }
  }, [clientId]);

  const initializeGoogleSignIn = () => {
    if (!window.google || !clientId) return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'email profile',
      callback: (response: any) => {
        if (response.access_token) {
          onSuccess(response.access_token);
        } else {
          onError?.(response);
        }
      },
    });
  };

  const signIn = useCallback(() => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken();
    }
  }, []);

  return { signIn, isReady: !!tokenClientRef.current };
};
