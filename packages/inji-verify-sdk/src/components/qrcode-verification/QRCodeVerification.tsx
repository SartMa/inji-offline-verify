import React, { useCallback, useEffect, useRef, useState } from "react";
import { scanResult } from "./QRCodeVerification.types";
import { scanFilesForQr, doFileChecks } from "../../utils/uploadQRCodeUtils";
import { warmUpZXingModule } from "../../utils/zxingModuleLoader";
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
import { createSdkLogger } from '../../utils/logger.js';

const qrLogger = createSdkLogger('QRCodeVerification');

const resolveFlag = (primary: unknown, fallback: unknown): unknown => (primary ?? fallback);

const isVerboseLoggingEnabled = (): boolean => {
  const processEnv = typeof process !== 'undefined' && process?.env ? process.env : undefined;

  const importMetaEnv = (() => {
    try {
      // @ts-ignore
      return typeof import.meta !== 'undefined' ? (import.meta as Record<string, any>).env : undefined;
    } catch {
      return undefined;
    }
  })();

  const flag = resolveFlag(
    resolveFlag(processEnv?.SDK_ENABLE_QR_DEBUG, processEnv?.SDK_ENABLE_LOGS),
    resolveFlag(importMetaEnv?.SDK_ENABLE_QR_DEBUG, importMetaEnv?.SDK_ENABLE_LOGS)
  );

  const globalFlag = resolveFlag((globalThis as any)?.SDK_ENABLE_QR_DEBUG, (globalThis as any)?.SDK_ENABLE_LOGS);

  const value = resolveFlag(flag, globalFlag);
  return value === true || value === 'true';
};

const logDebug = (...args: unknown[]) => {
  if (!isVerboseLoggingEnabled()) return;
  qrLogger.debug?.(...args);
};

const logError = (...args: unknown[]) => {
  if (!isVerboseLoggingEnabled()) return;
  qrLogger.error?.(...args);
};

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
  const [retryCount, setRetryCount] = useState(0); // Add retry counter
  const [isStartingCamera, setIsStartingCamera] = useState(false); // Add camera starting state
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<string | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const shouldEnableZoom = isEnableZoom && isMobile;

  useEffect(() => {
    warmUpZXingModule().catch((error) => {
      logError('ZXing warm-up failed', error);
    });
  }, []);

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
    logDebug('QR Scanner: startVideoStream called', { isEnableScan, isCameraActive, streaming: streamingRef.current, retryCount, isStartingCamera });
    
    if (!isEnableScan || isCameraActive || streamingRef.current || isStartingCamera) {
      logDebug('QR Scanner: Early return from startVideoStream - already active or starting');
      return;
    }

    // Set starting state to prevent multiple simultaneous starts
    setIsStartingCamera(true);

    // Check if video element exists, if not, retry with limit
    const video = videoRef.current;
    if (!video) {
      if (retryCount < 10) { // Max 10 retries (1 second total)
        logDebug(`QR Scanner: Video element not ready, retrying ${retryCount + 1}/10 in 100ms...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsStartingCamera(false); // Reset starting state before retry
          startVideoStream();
        }, 100);
        return;
      } else {
        logError('QR Scanner: Video element never became available after 10 retries');
        setIsStartingCamera(false);
        onError(new Error('Video element not available - camera cannot be initialized'));
        return;
      }
    }

    // Reset retry count when video element is found
    setRetryCount(0);
    
    const videoConstraints = {
      width: { ideal: CONSTRAINTS_IDEAL_WIDTH },
      height: { ideal: CONSTRAINTS_IDEAL_HEIGHT },
      frameRate: { ideal: CONSTRAINTS_IDEAL_FRAME_RATE },
      facingMode: 'environment' // Use back camera for QR scanning
    };
    
    const fallbackConstraints = {
      width: { ideal: CONSTRAINTS_IDEAL_WIDTH },
      height: { ideal: CONSTRAINTS_IDEAL_HEIGHT },
      frameRate: { ideal: CONSTRAINTS_IDEAL_FRAME_RATE }
      // No facingMode for fallback - use any available camera
    };
    
    logDebug('QR Scanner: Video element found! Requesting camera access with constraints:', videoConstraints);
    
    navigator.mediaDevices.getUserMedia({ video: videoConstraints })
      .then((stream) => {
        logDebug('QR Scanner: Camera stream obtained successfully');
        streamingRef.current = true;
        setIsCameraActive(true);
        setIsStartingCamera(false); // Reset starting state
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          logError('QR Scanner: Video element not found after getting stream');
          // Stop the stream if video element is not available
          stream.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          return;
        }
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          logDebug('QR Scanner: Video metadata loaded, starting playback');
          video.play().then(() => {
            logDebug('QR Scanner: Video playback started, beginning frame processing');
            setTimeout(processFrame, FRAME_PROCESS_INTERVAL_MS);
          }).catch((playError) => {
            logError('QR Scanner: Video play error:', playError);
            onError(playError);
          });
        };
      }).catch((streamError) => {
        logError('QR Scanner: Environment camera error, trying fallback:', streamError);
        // Fallback to any available camera
        navigator.mediaDevices.getUserMedia({ video: fallbackConstraints })
          .then((stream) => {
            logDebug('QR Scanner: Fallback camera stream obtained successfully');
            streamingRef.current = true;
            setIsCameraActive(true);
            setIsStartingCamera(false); // Reset starting state
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) {
              logError('QR Scanner: Video element not found in fallback');
              // Stop the stream if video element is not available
              stream.getTracks().forEach(track => track.stop());
              streamRef.current = null;
              return;
            }
            video.srcObject = stream;
            video.onloadedmetadata = () => {
              logDebug('QR Scanner: Fallback video metadata loaded');
              video.play().then(() => {
                logDebug('QR Scanner: Fallback video playback started');
                setTimeout(processFrame, FRAME_PROCESS_INTERVAL_MS);
              }).catch((playError) => {
                logError('QR Scanner: Fallback video play error:', playError);
                onError(playError);
              });
            };
          }).catch((fallbackError) => {
            logError('QR Scanner: All camera access attempts failed:', fallbackError);
            setIsStartingCamera(false);
            onError(fallbackError);
          });
      });
  }, [isEnableScan, isCameraActive, onError, processFrame, retryCount]);

  const stopVideoStream = () => {
    logDebug('QR Scanner: stopVideoStream called');
    streamingRef.current = false;
    setIsStartingCamera(false); // Reset starting state
    const video = videoRef.current;
    const stream = streamRef.current ?? (video?.srcObject as MediaStream | null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    if (video) {
      video.srcObject = null;
    }
    setIsCameraActive(false);
    logDebug('QR Scanner: stopVideoStream completed');
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
          logDebug('[QRCodeVerification] OVP QR detected. Full raw data:', data);
          const redirectUrl = extractRedirectUrlFromQrData(data);
          logDebug('[QRCodeVerification] Extracted redirect URL:', redirectUrl);
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
    if (!isEnableScan) {
      logDebug('QR Scanner: Scanning disabled, cleaning up...');
      return;
    }
    
    // Prevent multiple initializations
    if (isCameraActive || streamingRef.current) {
      logDebug('QR Scanner: Camera already active, skipping initialization');
      return;
    }
    
    // Add a delay to ensure the video element is mounted and DOM is ready
    const timer = setTimeout(() => {
      logDebug('QR Scanner: Starting video stream after delay...');
      startVideoStream();
    }, 250); // Increased delay to 250ms

    const sessionTimer = setTimeout(() => {
      logDebug('QR Scanner: Session expired, stopping camera');
      stopVideoStream();
      onError(new Error("scanSessionExpired"));
    }, ScanSessionExpiryTime);
    
    // Store the session timer reference
    timerRef.current = sessionTimer;
    
    return () => {
      logDebug('QR Scanner: Cleanup called');
      clearTimeout(timer);
      clearTimer();
      stopVideoStream();
    };
  }, [isEnableScan]); // Simplified dependencies - removed isUploading and startVideoStream

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

  const startScanning = isEnableScan && !isUploading && !isScanning; // Removed isCameraActive dependency
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

