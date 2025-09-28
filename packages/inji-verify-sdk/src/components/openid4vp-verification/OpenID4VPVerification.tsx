import { QRCodeSVG } from "qrcode.react";
import {
  OpenID4VPVerificationProps,
  QrData,
  VerificationResults,
  VerificationStatus,
  VPRequestBody,
} from "./OpenID4VPVerification.types";
import React, { useCallback, useEffect, useState } from "react";
import { PresentationVerifier } from "../../services/offline-verifier/PresentationVerifier";

const OpenID4VPVerification: React.FC<OpenID4VPVerificationProps> = ({
  triggerElement,
  verifyServiceUrl,
  protocol,
  presentationDefinitionId,
  presentationDefinition,
  onVPReceived,
  onVPProcessed,
  qrCodeStyles,
  onQrCodeExpired,
  onError,
}) => {
  const [txnId, setTxnId] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const expirationTimerRef = React.useRef<number | null>(null);
  const OPENID4VP_PROTOCOL = `${protocol || "openid4vp://"}authorize?`;

  const generateNonce = (): string => {
    return btoa(Date.now().toString());
  };

  const VPFormat = {
    ldp_vp: {
      proof_type: [
        "Ed25519Signature2018",
        "Ed25519Signature2020",
        "RsaSignature2018",
      ],
    },
  };

  // Base64URL decode helper (mirrors QRCodeVerification)
  function base64UrlDecode(base64url: string): string {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    return atob(base64);
  }

  const getPresentationDefinition = useCallback(
    (data: QrData) => {
      const params = new URLSearchParams();
      // For client-side verification, direct wallet back to this origin via fragment
      const origin = window.location.origin;
      params.set("client_id", origin);
      params.set("response_type", data.authorizationDetails.responseType);
      params.set("response_mode", "fragment");
      params.set("redirect_uri", `${origin}/`);
      params.set("nonce", data.authorizationDetails.nonce);
      params.set("state", data.requestId);
      if (data.authorizationDetails.presentationDefinitionUri) {
        params.set(
          "presentation_definition_uri",
          verifyServiceUrl + data.authorizationDetails.presentationDefinitionUri
        );
      } else {
        params.set(
          "presentation_definition",
          JSON.stringify(data.authorizationDetails.presentationDefinition)
        );
      }
      params.set(
        "client_metadata",
        JSON.stringify({ client_name: window.location.host, vp_formats: VPFormat })
      );
      return params.toString();
    },
    [verifyServiceUrl]
  );

  // Handle return from wallet: verify VP locally using PresentationVerifier
  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash;
        if (!hash) return;
        const params = new URLSearchParams(hash.substring(1));
        const vpTokenParam = params.get("vp_token");
        const presentationSubmission = params.get("presentation_submission");
        const error = params.get("error");

        if (error) {
          onError(new Error(error));
          return;
        }

        if (vpTokenParam && presentationSubmission) {
          const decoded = base64UrlDecode(vpTokenParam);
          // vpToken can be JSON string; ensure we pass a canonical string to verifier
          const vpObj = JSON.parse(decoded);

          // If consumer wants to know when VP is received, notify with txnId if available
          if (onVPReceived && txnId) {
            onVPReceived(txnId);
          }

          try {
            const verifier = new PresentationVerifier();
            const verification = await verifier.verify(JSON.stringify(vpObj));
            if (onVPProcessed) {
              // Map verifier results to UI-friendly shape
              const mapStatus = (s: any): VerificationStatus => {
                const v = typeof s === 'string' ? s.toUpperCase() : String(s).toUpperCase();
                if (v.includes('EXPIRED')) return 'expired';
                if (v.includes('SUCCESS') || v.includes('VALID')) return 'valid';
                return 'invalid';
              };
              const VPResult: VerificationResults = (verification.vcResults || []).map((r: any) => ({
                vc: (() => { try { return JSON.parse(r.vc); } catch { return r.vc; } })(),
                vcStatus: mapStatus(r.verificationStatus ?? r.status),
              }));
              onVPProcessed(VPResult);
            }
          } catch (e) {
            onError(e as Error);
          } finally {
            // Clean the URL fragment
            window.history.replaceState(null, "", window.location.pathname);
            if (expirationTimerRef.current) {
              window.clearTimeout(expirationTimerRef.current);
              expirationTimerRef.current = null;
            }
            setTxnId(null);
            setReqId(null);
            setQrCodeData(null);
            setExpiresAt(null);
            setLoading(false);
          }
        }
      } catch (e) {
        onError(e as Error);
      }
    })();
    // We intentionally exclude dependencies to run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createVpRequest = useCallback(async () => {
    if (presentationDefinition?.input_descriptors.length !== 0) {
      try {
        addStylesheetRules();
        setLoading(true);
        const requestBody: VPRequestBody = {
          clientId: window.location.host,
          nonce: generateNonce(),
        };

        if (txnId) requestBody.transactionId = txnId;
        if (presentationDefinitionId)
          requestBody.presentationDefinitionId = presentationDefinitionId;
        if (presentationDefinition)
          requestBody.presentationDefinition = presentationDefinition;

        const response = await fetch(`${verifyServiceUrl}/vp-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (response.status !== 201)
          throw new Error("Failed to create VP request");
        const data: QrData = await response.json();
        const qrData = OPENID4VP_PROTOCOL + getPresentationDefinition(data);
        setTxnId(data.transactionId);
        setReqId(data.requestId);
        setQrCodeData(qrData);
        setExpiresAt(data.expiresAt);

        // Setup local expiration timer (no server polling)
        if (expirationTimerRef.current) {
          window.clearTimeout(expirationTimerRef.current);
          expirationTimerRef.current = null;
        }
        const ms = Math.max(0, data.expiresAt - Date.now());
        expirationTimerRef.current = window.setTimeout(() => {
          setTxnId(null);
          setReqId(null);
          setQrCodeData(null);
          setExpiresAt(null);
          onQrCodeExpired();
        }, ms);
        setLoading(false);
      } catch (error) {
        setLoading(false);
        onError(error as Error);
      }
    }
  }, [
    presentationDefinition,
    txnId,
    presentationDefinitionId,
    verifyServiceUrl,
    OPENID4VP_PROTOCOL,
    getPresentationDefinition,
    onError,
  ]);

  useEffect(() => {
    if (!presentationDefinitionId && !presentationDefinition) {
      throw new Error(
        "Either presentationDefinitionId or presentationDefinition must be provided, but not both"
      );
    }
    if (presentationDefinitionId && presentationDefinition) {
      throw new Error(
        "Both presentationDefinitionId and presentationDefinition cannot be provided simultaneously"
      );
    }
    if (!onVPReceived && !onVPProcessed) {
      throw new Error(
        "Either onVpReceived or onVpProcessed must be provided, but not both"
      );
    }
    if (onVPReceived && onVPProcessed) {
      throw new Error(
        "Both onVPReceived and onVPProcessed cannot be provided simultaneously"
      );
    }
    if (!onQrCodeExpired) {
      throw new Error("onQrCodeExpired callback is required");
    }
    if (!onError) {
      throw new Error("onError callback is required");
    }
    if (!triggerElement) {
      createVpRequest();
    }
  }, [
    createVpRequest,
    onError,
    onQrCodeExpired,
    onVPProcessed,
    onVPReceived,
    presentationDefinition,
    presentationDefinitionId,
    triggerElement,
  ]);

  // No polling when using client-side fragment return flow

  function addStylesheetRules() {
    let keyframes = `@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}`;
    var styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    var styleSheet = styleEl.sheet;
    styleSheet?.insertRule(keyframes, 0);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (expirationTimerRef.current) {
        window.clearTimeout(expirationTimerRef.current);
        expirationTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minWidth: "100%",
      }}
    >
      {triggerElement && !qrCodeData && !loading ? (
        <div onClick={createVpRequest} style={{ cursor: "pointer" }}>
          {triggerElement}
        </div>
      ) : null}
      {loading && (
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #ccc",
            borderTop: "4px solid #333",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "20px auto",
          }}
        ></div>
      )}
      {!loading && qrCodeData && (
        <div data-testid="qr-code">
          <QRCodeSVG
            value={qrCodeData}
            size={qrCodeStyles?.size || 200}
            level={qrCodeStyles?.level || "L"}
            bgColor={qrCodeStyles?.bgColor || "#ffffff"}
            fgColor={qrCodeStyles?.fgColor || "#000000"}
            marginSize={qrCodeStyles?.margin || 10}
            style={{ borderRadius: qrCodeStyles?.borderRadius || 10 }}
          />
        </div>
      )}
    </div>
  );
};

export default OpenID4VPVerification;
