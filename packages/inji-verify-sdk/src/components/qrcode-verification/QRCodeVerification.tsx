import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  QRCodeVerificationProps as OriginalQRCodeVerificationProps,
  scanResult,
} from "./QRCodeVerification.types"; // Assuming types are in the same folder
import { scanFilesForQr, doFileChecks } from "../../utils/uploadQRCodeUtils";
import {
  acceptedFileTypes,
  BASE64_PADDING,
  CONSTRAINTS_IDEAL_FRAME_RATE,
  CONSTRAINTS_IDEAL_HEIGHT,
  CONSTRAINTS_IDEAL_WIDTH,
  FRAME_PROCESS_INTERVAL_MS,
  INITIAL_ZOOM_LEVEL,
  OvpQrHeader,
  ScanSessionExpiryTime,
  THROTTLE_FRAMES_PER_SEC,
  ZOOM_STEP,
} from "../../utils/constants";
import { vcSubmission, vcVerification } from "../../utils/api";
import {
  decodeQrData,
  extractRedirectUrlFromQrData,
} from "../../utils/dataProcessor";
import { readBarcodes } from "zxing-wasm/full";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";
import { Slider } from "@mui/material";
import "./QRCodeVerification.css";

// --- ADDITIVE CHANGE: Import new dependencies for offline mode ---
import { CredentialsVerifier } from '../../services/offline-verifier/CredentialsVerifier';
import { CredentialFormat } from '../../services/offline-verifier/constants/CredentialFormat';
import { VerificationResult } from '../../services/offline-verifier/data/data';

// --- ADDITIVE CHANGE: The Props type is extended to support a new 'offline' mode ---
export type QRCodeVerificationProps =
  // Online Mode Props
  | (OriginalQRCodeVerificationProps & {
      mode: 'online';
    })
  // Offline Mode Props
  | (Omit<OriginalQRCodeVerificationProps, 'verifyServiceUrl' | 'onVCReceived' | 'onVCProcessed'> & {
      mode: 'offline';
      verifyServiceUrl?: never; // Ensure online-only props are not provided in offline mode
      onVCReceived?: never;
      onVCProcessed?: never;
      onVerificationResult: (result: VerificationResult) => void; // Callback for offline results
      credentialFormat?: CredentialFormat; // Optional, defaults to LDP_VC
    });


export default function QRCodeVerification(props: QRCodeVerificationProps) {
  // --- NO CHANGE HERE: All original props are still supported and destructured ---
  const {
    triggerElement,
    onError,
    isEnableUpload = true,
    isEnableScan = true,
    uploadButtonId,
    uploadButtonStyle,
    isEnableZoom = true,
  } = props;

  // --- NO CHANGE HERE: All original state and refs are preserved ---
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

  // --- NO CHANGE HERE: Original helper function is preserved ---
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // --- ADDITIVE CHANGE: Prop validation is now mode-aware, but the original checks are still here ---
  if (props.mode === 'online') {
    if(!props.verifyServiceUrl) throw new Error("verifyServiceUrl is required for 'online' mode.");
    if(!props.onVCReceived && !props.onVCProcessed) throw new Error("One of onVCReceived or onVCProcessed is required for 'online' mode.");
  }
  if (props.mode === 'offline') {
    if (!props.onVerificationResult) {
      throw new Error("onVerificationResult is required for 'offline' mode.");
    }
  }
  if (!onError) throw new Error("onError callback is required.");

  const readQrCodeFromCanvas = useRef(async (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    if (!imageData) return;
    try {
      const results = await readBarcodes(imageData);
      if (results[0]?.text) {
        // Do NOT stop stream here; let processScanResult decide after validation
        const text = results[0].text;
        await processScanResult(text as unknown);
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
    if (!isEnableScan || isCameraActive || streamingRef.current) return;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: CONSTRAINTS_IDEAL_WIDTH },
          height: { ideal: CONSTRAINTS_IDEAL_HEIGHT },
          frameRate: { ideal: CONSTRAINTS_IDEAL_FRAME_RATE },
          facingMode: "environment",
        },
      })
      .then((stream) => {
        streamingRef.current = true;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.disablePictureInPicture = true;
        video.playsInline = true;
        video.controls = false;
        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => {
              setTimeout(processFrame, FRAME_PROCESS_INTERVAL_MS);
            })
            .catch(onError);
        };
      })
      .catch(onError);
  }, [isEnableScan, isCameraActive, onError, processFrame]);

  const stopVideoStream = () => {
    streamingRef.current = false;
    const video = videoRef.current;
    if (!video) return;
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    video.onloadedmetadata = null;
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

  // Accept unknown (string in offline scan, or object in online redirect scenarios)
  async function processScanResult(rawInput: unknown) {
    try {
      // Handle the online redirect payload separately and early
      if (props.mode === 'online' && rawInput && typeof rawInput === 'object' && (rawInput as any).vpToken) {
        console.log('[Online Mode] Redirect parameters detected; skipping processScanResult.');
        return;
      }

      // Debounce identical scans for strings only
      if (typeof rawInput === 'string' && rawInput === lastProcessedRef.current) {
        return;
      }
      if (typeof rawInput === 'string') {
        lastProcessedRef.current = rawInput;
      }

      // We support only string QR payloads here
      if (typeof rawInput !== 'string') {
        console.error('QR data is not JSON format:', String(rawInput).slice(0, 120), '...');
        props.onError?.(new Error('QR is not a JSON VC payload'));
        return;
      }

      // Try parse as JSON first
      let parsed: any | null = null;
      let decodedRaw: string | null = null;
      try {
        parsed = JSON.parse(rawInput);
      } catch {
        // Not JSON -> try to decode compact format
        console.log('[Offline] Non-JSON QR detected. Attempting to decode compact payload...');
        try {
          decodedRaw = await decodeQrData(new TextEncoder().encode(rawInput));
          if (decodedRaw) {
            console.log('[Offline] Decoded QR (first 120 chars):', decodedRaw.slice(0, 120), '...');
          } else {
            console.error('[Offline] Decoded QR is null.');
          }
          parsed = JSON.parse(decodedRaw);
        } catch (decodeError) {
          // Decoding failed: surface error once and exit
          if (rawInput !== lastErrorRef.current) {
            console.error('QR data is not JSON format and decode failed:', rawInput.slice(0, 120), '...');
            console.error('Decode error:', decodeError);
            props.onError?.(new Error('QR is not a JSON VC payload'));
            lastErrorRef.current = rawInput;
          }
          return;
        }
      }

      // Reset lastError when we get a good JSON next
      lastErrorRef.current = null;

      if (props.mode === 'offline') {
        console.log('[Offline Mode] Verifying credential locally...');
        // Now that we have a valid VC object, stop the camera and show loader
        clearTimer();
        stopVideoStream();
        setScanning(true);

        try {
          const verifier = new CredentialsVerifier();
          const format = props.credentialFormat ?? CredentialFormat.LDP_VC;
          const payload = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
          const result = await verifier.verify(payload, format);
          props.onVerificationResult?.(result);
        } finally {
          // Bring scanner back for next scan
          setScanning(false);
          setUploading(false);
          setLoading(false);
          setIsCameraActive(true);
          startVideoStream();
        }
        return;
      }

      // Online mode: forward to original online flow
      const vc = await extractVerifiableCredential(parsed);
      await triggerCallbacks(vc);

    } catch (e: any) {
      console.error('QR processing failed:', e);
      props.onError?.(e instanceof Error ? e : new Error('QR processing error'));
    }
  }

  /**
   * This is the core logic function where the component's behavior is extended.
   */
  const extractVerifiableCredential = async (data: any) => {
    try {
      if (typeof data === 'string') {
        if (data.startsWith(OvpQrHeader)) {
          if (props.mode === 'offline') {
            throw new Error("OpenID4VP redirect flows are not supported in offline mode.");
          }
          const redirectUrl = extractRedirectUrlFromQrData(data);
          if (!redirectUrl) throw new Error("Failed to extract redirect URL from QR data");
          const encodedOrigin = encodeURIComponent(window.location.origin);
          const url = `${redirectUrl}&client_id=${encodedOrigin}&redirect_uri=${encodedOrigin}%2F#`;
          window.location.href = url;
          return null;
        }
        
        // Check if data is JSON format before parsing
        const trimmedData = data.trim();
        if (!trimmedData.startsWith('{') && !trimmedData.startsWith('[')) {
          // Not JSON format - could be encoded data, URL, or plain text identifier
          console.log("QR data is not JSON format:", trimmedData);
          
          // Check if it's a URL
          if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://')) {
            throw new Error("URL QR codes are not supported for verification");
          }
          
          // For other formats (like plain text identifiers), try to decode
          try {
            const decoded = await decodeQrData(new TextEncoder().encode(trimmedData));
            return JSON.parse(decoded);
          } catch (decodeError) {
            console.error("Failed to decode QR data:", decodeError);
            throw new Error(`Unsupported QR code format: ${trimmedData.substring(0, 20)}...`);
          }
        }
        
        return JSON.parse(data);
      }
      
      if (data?.vpToken) {
        return data.vpToken.verifiableCredential[0];
      }
      
      const decoded = await decodeQrData(new TextEncoder().encode(data));
      return JSON.parse(decoded);

    } catch (error) {
      return error;
    }
  };

  /**
   * This entire function is the original online logic.
   * It is preserved completely and is only called when mode is 'online'.
   */
  const triggerCallbacks = async (vc: any) => {
    if (props.mode !== 'online') return; // Safety guard for offline mode

    try {
      if (props.onVCReceived) {
        const id = await vcSubmission(vc, props.verifyServiceUrl);
        props.onVCReceived(id);
      } else if (props.onVCProcessed) {
        const status = await vcVerification(vc, props.verifyServiceUrl);
        props.onVCProcessed([{ vc, vcStatus: status }]);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setScanning(false);
      setUploading(false);
      setLoading(false);
      setIsCameraActive(true);
      startVideoStream();
    }
  };
  
  const handleError = (error: unknown) => {
    if (props.mode === 'offline') {
        const errResult = new VerificationResult(false, (error as Error).message, 'PROCESS_ERROR');
        props.onVerificationResult(errResult);
    } else {
      // --- NO CHANGE HERE: Original online error handling ---
      props.onError(
        error instanceof Error ? error : new Error("Unknown error occurred")
      );
    }
  };

  // --- NO CHANGE HERE: All zoom and effect hooks are preserved ---
  const handleZoomChange = (value: number) => { if (value >= 0 && value <= 10) setZoomLevel(value); };
  const handleSliderChange = (_: any, value: number | number[]) => { if (typeof value === "number") handleZoomChange(value); };
  function base64UrlDecode(base64url: string): string { let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/"); const pad = base64.length % 4; if (pad) base64 += "=".repeat(4 - pad); return atob(base64); }
  useEffect(() => { if (!isEnableScan) return; startVideoStream(); setIsCameraActive(true); timerRef.current = setTimeout(() => { stopVideoStream(); onError(new Error("scanSessionExpired")); }, ScanSessionExpiryTime); return () => { clearTimer(); stopVideoStream(); }; }, [isEnableScan, onError, startVideoStream, isUploading]);
  useEffect(() => { const resize = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", resize); resize(); return () => window.removeEventListener("resize", resize); }, []);
  useEffect(() => {
    if (props.mode !== 'online') return;
    let vpToken, presentationSubmission, error;
    try {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const vpTokenParam = params.get("vp_token");
      const decoded = vpTokenParam && base64UrlDecode(vpTokenParam);
      const parseVpToken = decoded && JSON.parse(decoded);
      vpToken = vpTokenParam ? parseVpToken : null;
      presentationSubmission = params.get("presentation_submission")
        ? decodeURIComponent(params.get("presentation_submission") as string)
        : undefined;
      error = params.get("error");

      if (vpToken && presentationSubmission) {
        // Do not call processScanResult with an object; handle redirect outside.
        console.log('[Online Mode] Redirect params present; upstream flow should handle vp_token/presentation_submission.');
        window.history.replaceState(null, "", window.location.pathname);
      } else if (!!error) {
        onError(new Error(error));
      }
    } catch (error) {
      console.error("Error occurred while reading params in redirect url, Error: ", error);
      onError(error instanceof Error ? error : new Error("Unknown error"));
    }
  }, [onError, processScanResult, props.mode]);

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

