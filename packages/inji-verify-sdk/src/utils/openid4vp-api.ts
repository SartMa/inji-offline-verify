import { createSdkLogger } from './logger';

const logger = createSdkLogger('openid4vp-api');

export interface OpenID4VPSessionRequest {
  presentation_definition_id: string;
  expires_in_minutes?: number;
}

export interface OpenID4VPSessionResponse {
  session_id: string;
  authorization_request_uri: string;
  expires_at: string;
  status: string;
  presentation_definition_id: string;
}

export interface OpenID4VPStatusResponse {
  session_id: string;
  status: 'pending' | 'completed' | 'expired' | 'error';
  created_at: string;
  expires_at: string;
  presentation_definition_id: string;
  is_expired: boolean;
  verification_result?: any;
  verification_summary?: {
    verified: boolean;
    verified_at: string;
    credential_count: number;
    verification_method: string;
    credentials_summary: Array<{
      type: string[];
      issuer: string;
      verified: boolean;
    }>;
  };
  error_message?: string;
  time_remaining_seconds?: number;
}

export interface VerificationResult {
  vc: Record<string, unknown>;
  vcStatus: 'valid' | 'invalid' | 'expired';
}

/**
 * Create a new OpenID4VP verification session
 */
export const createOpenID4VPSession = async (
  url: string,
  sessionRequest: OpenID4VPSessionRequest,
  authToken?: string
): Promise<OpenID4VPSessionResponse> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const requestOptions = {
    method: "POST",
    headers,
    body: JSON.stringify(sessionRequest),
  };

  try {
    const response = await fetch(`${url}/api/openid4vp/sessions/`, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OpenID4VPSessionResponse = await response.json();
    return data;
  } catch (error) {
    logger.debug?.(error);
    if (error instanceof Error) {
      throw Error(error.message);
    } else {
      throw new Error("An unknown error occurred while creating OpenID4VP session");
    }
  }
};

/**
 * Get the status of an OpenID4VP verification session
 */
export const getOpenID4VPSessionStatus = async (
  url: string,
  sessionId: string,
  authToken?: string
): Promise<OpenID4VPStatusResponse> => {
  const headers: Record<string, string> = {};

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const requestOptions = {
    method: "GET",
    headers,
  };

  try {
    const response = await fetch(`${url}/api/openid4vp/status/${sessionId}/`, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OpenID4VPStatusResponse = await response.json();
    return data;
  } catch (error) {
    logger.debug?.(error);
    if (error instanceof Error) {
      throw Error(error.message);
    } else {
      throw new Error("An unknown error occurred while getting session status");
    }
  }
};

/**
 * Get presentation definition for a session (public endpoint)
 */
export const getPresentationDefinition = async (
  url: string,
  sessionId: string
): Promise<any> => {
  const requestOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await fetch(`${url}/api/openid4vp/presentation-definition/${sessionId}/`, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.debug?.(error);
    if (error instanceof Error) {
      throw Error(error.message);
    } else {
      throw new Error("An unknown error occurred while getting presentation definition");
    }
  }
};