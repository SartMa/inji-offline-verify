import React, { useCallback, useEffect, useRef, useState } from "react";
import { scanResult } from "./QRCodeVerification.types";
import { scanFilesForQr, doFileChecks } from "../../utils/uploadQRCodeUtils";
import {
  acceptedFileTypes,
  CONSTRAINTS_IDEAL_FRAME_RATE,
  CONSTRAINTS_IDEAL_HEIGHT,
  CONSTRAINTS_IDEAL_WIDTH,
  FRAME_PROCESS_INTERVAL_MS,
  INITIAL_ZOOM_LEVEL,
  ScanSessionExpiryTime,
  THROTTLE_FRAMES_PER_SEC,
  ZOOM_STEP,
  // --- ADDED FOR REDIRECT FLOW ---
  OvpQrHeader, 
} from "../../utils/constants";
import {
  decodeQrData,
  // --- ADDED FOR REDIRECT FLOW ---
  extractRedirectUrlFromQrData,
} from "../../utils/dataProcessor";
import { readBarcodes } from "zxing-wasm/full";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";
import { Slider } from "@mui/material";
import "./QRCodeVerification.css";

import { CredentialsVerifier } from '../../services/offline-verifier/CredentialsVerifier';
import { PresentationVerifier } from '../../services/offline-verifier/PresentationVerifier';
import { CredentialFormat } from '../../services/offline-verifier/constants/CredentialFormat';
import {
  VerificationResult,
  VPVerificationStatus,
  VerificationStatus as CredentialVerificationStatus,
} from '../../services/offline-verifier/data/data';

export interface QRCodeVerificationProps {
  triggerElement?: React.ReactNode;
  onError: (error: Error) => void;
  isEnableUpload?: boolean;
  isEnableScan?: boolean;
  uploadButtonId?: string;
  uploadButtonStyle?: string;
  isEnableZoom?: boolean;
  onVerificationResult: (result: VerificationResult) => void;
  credentialFormat?: CredentialFormat;
}


export default function QRCodeVerification(props: QRCodeVerificationProps) {
  const {
    triggerElement,
    onError,
    isEnableUpload = true,
    isEnableScan = true,
    uploadButtonId,
    uploadButtonStyle,
    isEnableZoom = true,
  } = props;

  const [isScanning, setScanning] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM_LEVEL);
  const [isMobile, setIsMobile] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const shouldEnableZoom = isEnableZoom && isMobile;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  if (!onError) throw new Error("onError callback is required.");
  if (!props.onVerificationResult) throw new Error("onVerificationResult is required.");

  const readQrCodeFromCanvas = useRef(async (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    if (!imageData) return;
    try {
      const results = await readBarcodes(imageData);
      if (results[0]?.text) {
        const text = results[0].text;
        await processScanResult(text);
      }
    } catch (error) {
      handleError(error);
    }
  });

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    readQrCodeFromCanvas.current(canvas);
    setTimeout(
      () => requestAnimationFrame(processFrame),
      THROTTLE_FRAMES_PER_SEC
    );
  }, []);

  const startVideoStream = useCallback(() => {
    if (!isEnableScan || isCameraActive || streamingRef.current) {
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { /* ... constraints ... */ } })
      .then((stream) => {
        streamingRef.current = true;
        setIsCameraActive(true);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setTimeout(processFrame, FRAME_PROCESS_INTERVAL_MS);
          }).catch((playError) => onError(playError));
        };
      }).catch((streamError) => onError(streamError));
  }, [isEnableScan, isCameraActive, onError, processFrame]);

  const stopVideoStream = () => {
    streamingRef.current = false;
    const video = videoRef.current;
    if (!video) return;
    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
    setIsCameraActive(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      clearTimer();
      stopVideoStream();
      const file = e.target?.files?.[0];
      if (!file || !doFileChecks(file)) return (e.target.value = "");
      setUploading(true);
      const result: scanResult = await scanFilesForQr(file);
      if (result.error) throw result.error;
      await processScanResult(result.data);
      e.target.value = "";
    } catch (error) {
      e.target.value = "";
      setUploading(false);
      handleError(error);
    }
  };

  /**
   * --- ADDED FOR REDIRECT FLOW ---
   * This helper function now decides if the scanned data is a direct credential,
   * a redirect URL, or something else.
   */
  const extractVerifiableCredential = async (data: any) => {
    try {
      // Handles the return trip from the wallet (data is an object)
      if (data?.vpToken) {
        return data.vpToken.verifiableCredential[0];
      }

      // Handles the initial scan (data is a string from QR code)
      if (typeof data === 'string') {
        if (data.startsWith(OvpQrHeader)) {
          // Log the entire QR data when it starts with the OVP header
          // Note: This may include sensitive information depending on your QR content.
          // Remove or guard this log for production if necessary.
          // eslint-disable-next-line no-console
          console.log('[QRCodeVerification] OVP QR detected. Full raw data:', data);
          const redirectUrl = extractRedirectUrlFromQrData(data);
          // eslint-disable-next-line no-console
          console.log('[QRCodeVerification] Extracted redirect URL:', redirectUrl);
          if (!redirectUrl) throw new Error("Failed to extract redirect URL from QR data");
          const encodedOrigin = encodeURIComponent(window.location.origin);
          const url = `${redirectUrl}&client_id=${encodedOrigin}&redirect_uri=${encodedOrigin}%2F#`;
          // window.location.href = url; // Perform the redirect
          return null; // Return null to stop further processing in this component
        }
        
        // If not a redirect, assume it's a direct payload that needs decoding
        const decoded = await decodeQrData(new TextEncoder().encode(data));
        return JSON.parse(decoded);
      }

      // If data is not a string and not a vpToken object, it's an unsupported format
      throw new Error("Unsupported QR code data format");
      
    } catch (error) {
      handleError(error);
      return null;
    }
  };

  const isVerifiablePresentation = (payload: any): boolean => {
    if (!payload) return false;
    const typeField = payload.type;
    if (Array.isArray(typeField) && typeField.includes('VerifiablePresentation')) return true;
    if (typeof typeField === 'string' && typeField === 'VerifiablePresentation') return true;
    return Array.isArray(payload.verifiableCredential) || !!payload.verifiableCredential;
  };

  const verifyPresentationPayload = async (presentationPayload: any): Promise<VerificationResult> => {
    const presentationVerifier = new PresentationVerifier();
    const presentationJson = typeof presentationPayload === 'string'
      ? presentationPayload
      : JSON.stringify(presentationPayload);

    const presentationResult = await presentationVerifier.verify(presentationJson);
    const proofValid = presentationResult.proofVerificationStatus === VPVerificationStatus.VALID;
    const hasInvalidVc = presentationResult.vcResults.some(
      (vc) => vc.status === CredentialVerificationStatus.INVALID,
    );
    const hasExpiredVc = presentationResult.vcResults.some(
      (vc) => vc.status === CredentialVerificationStatus.EXPIRED,
    );

    // Handle expired credentials the same way as other signatures - valid but expired
    const overallStatus = proofValid && !hasInvalidVc; // Remove hasExpiredVc from failure condition
    const reasons: string[] = [];
    if (!proofValid) reasons.push('presentation proof invalid');
    if (hasInvalidVc) reasons.push('credential invalid');

    const message = overallStatus
      ? hasExpiredVc 
        ? 'Presentation verified successfully (credential expired)'
        : 'Presentation verification successful'
      : `Presentation verification failed${reasons.length ? `: ${reasons.join(', ')}` : ''}`;

    // Set appropriate error code for expired credentials
    let errorCode = '';
    if (!overallStatus) {
      errorCode = 'VP_VERIFICATION_FAILED';
    } else if (hasExpiredVc) {
      errorCode = 'VC_EXPIRED'; // Same as other signature handlers use
    }

    const result = new VerificationResult(
      overallStatus,
      message,
      errorCode,
      presentationPayload,
    ) as VerificationResult & { presentationVerification?: typeof presentationResult };

    result.presentationVerification = presentationResult;

    return result;
  };

  async function processScanResult(rawInput: unknown) {
    try {
      if (typeof rawInput === 'string') {
        if (rawInput === lastProcessedRef.current) return;
        lastProcessedRef.current = rawInput;
      }

      // --- MODIFIED: Use the extractor function ---
      const credentialPayload = await extractVerifiableCredential(rawInput);
      
      // If the extractor returned null, it means a redirect was triggered, so we stop here.
      if (credentialPayload === null) {
        return;
      }
      
      // If we get here, we have a credential to verify.
      clearTimer();
      stopVideoStream();
      setScanning(true);
      setLoading(true);

      try {
        let verificationOutcome: VerificationResult;

        if (isVerifiablePresentation(credentialPayload)) {
          verificationOutcome = await verifyPresentationPayload(credentialPayload);
        } else {
          const verifier = new CredentialsVerifier();
          const format = props.credentialFormat ?? CredentialFormat.LDP_VC;
          const payload = typeof credentialPayload === 'string'
            ? credentialPayload
            : JSON.stringify(credentialPayload);
          const result = await verifier.verify(payload, format);

          if (result && typeof result === 'object' && 'verificationStatus' in result) {
            verificationOutcome = result as VerificationResult;
            if (!verificationOutcome.payload) {
              verificationOutcome.payload = credentialPayload;
            }
          } else {
            const wrapped = new VerificationResult(
              !!result,
              !!result ? 'Verification successful' : 'Verification failed',
              '',
            );
            wrapped.payload = credentialPayload;
            verificationOutcome = wrapped;
          }
        }

        props.onVerificationResult?.(verificationOutcome);
      } finally {
        setScanning(false);
        setUploading(false);
        setLoading(false);
        setIsCameraActive(true);
        startVideoStream();
      }
    } catch (e: any) {
      handleError(e);
    }
  }

  const handleError = (error: unknown) => {
    const errResult = new VerificationResult(false, (error as Error).message, 'PROCESS_ERROR');
    props.onVerificationResult(errResult);
  };
  
  // --- ADDED FOR REDIRECT FLOW ---
  // Helper function to decode Base64URL
  function base64UrlDecode(base64url: string): string {
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    return atob(base64);
  }

  const handleZoomChange = (value: number) => { if (value >= 0 && value <= 10) setZoomLevel(value); };
  const handleSliderChange = (_: any, value: number | number[]) => { if (typeof value === "number") handleZoomChange(value); };

  useEffect(() => {
    if (!isEnableScan) return;
    startVideoStream();
    timerRef.current = setTimeout(() => {
      stopVideoStream();
      onError(new Error("scanSessionExpired"));
    }, ScanSessionExpiryTime);
    return () => {
      clearTimer();
      stopVideoStream();
    };
  }, [isEnableScan, isUploading]); // Simplified dependencies

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, []);

  /**
   * --- ADDED FOR REDIRECT FLOW ---
   * This effect runs once on page load to check if the user is returning from a wallet.
   * If it finds a vp_token in the URL, it processes it.
   */
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (!hash) return;

      const params = new URLSearchParams(hash.substring(1));
      const vpTokenParam = params.get("vp_token");
      const presentationSubmission = params.get("presentation_submission");
      const error = params.get("error");

      if (error) {
        handleError(new Error(error));
        return;
      }
      
      if (vpTokenParam && presentationSubmission) {
        const decoded = base64UrlDecode(vpTokenParam);
        const vpToken = JSON.parse(decoded);
        
        // Pass the full payload to the processor
        processScanResult({ vpToken, presentationSubmission });
        
        // Clean the URL
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (e) {
      handleError(e);
    }
  }, []); // Empty dependency array means this runs only once on mount.

  const startScanning = isCameraActive && isEnableScan && !isUploading && !isScanning;
  // --- NO CHANGE HERE: The entire JSX and UI rendering is preserved exactly as it was ---
  return (
    <div className="qrcode-container">
      {triggerElement && !isUploading && !isScanning && !isLoading && (
        <div className="cursor-pointer">{triggerElement}</div>
      )}
      {(isUploading || isScanning || isLoading) && (
        <div className="loader"></div>
      )}
      <div className={`qr-wrapper ${!shouldEnableZoom ? "no-zoom" : ""}`}>
        {startScanning && (
          <div
            className={`scan-container ${
              shouldEnableZoom ? "zoom-enabled" : "no-zoom"
            }`}
          >
            {shouldEnableZoom && (
              <button
                onClick={stopVideoStream}
                className="qr-close-button"
                aria-label="Close Scanner"
              >
                ✕
              </button>
            )}
            <video
              ref={videoRef}
              className="qr-video"
              style={{
                transform: shouldEnableZoom
                  ? `scale(${1 + zoomLevel / ZOOM_STEP})`
                  : undefined,
              }}
              playsInline
              autoPlay
              muted
            />
            {shouldEnableZoom && (
              <div className="qr-overlay">
                <div className="centered-row">
                  <MinusOutlined
                    onClick={() => handleZoomChange(zoomLevel - 1)}
                    className={`zoom-button-decrease${
                      zoomLevel === 0 ? " disabled" : ""
                    }`}
                  />
                  <div className="slider-container">
                    <Slider
                      key={`${zoomLevel}`}
                      aria-label="Zoom Level"
                      min={0}
                      max={10}
                      step={1}
                      value={zoomLevel}
                      onChange={handleSliderChange}
                      onChangeCommitted={handleSliderChange}
                      marks
                      valueLabelDisplay="on"
                    />
                  </div>
                  <PlusOutlined
                    onClick={() => handleZoomChange(zoomLevel + 1)}
                    className={`zoom-button-increase${
                      zoomLevel === 10 ? " disabled" : ""
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {isEnableUpload && (
          <div
            className={`upload-container ${
              shouldEnableZoom ? "fixed-enabled" : "default"
            }`}
          >
            <input
              type="file"
              id={uploadButtonId || "upload-qr"}
              name={uploadButtonId || "upload-qr"}
              accept={acceptedFileTypes}
              className={`upload-button ${
                uploadButtonStyle || "upload-button-default"
              }`}
              onChange={handleUpload}
              disabled={isUploading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

