import React, { useCallback, useEffect, useRef, useState } from "react";
import { scanResult } from "./QRCodeVerification.types"; // types used only for scan result
import { scanFilesForQr, doFileChecks } from "../../utils/uploadQRCodeUtils";
import {
  acceptedFileTypes,
  BASE64_PADDING,
  CONSTRAINTS_IDEAL_FRAME_RATE,
  CONSTRAINTS_IDEAL_HEIGHT,
  CONSTRAINTS_IDEAL_WIDTH,
  FRAME_PROCESS_INTERVAL_MS,
  INITIAL_ZOOM_LEVEL,
  ScanSessionExpiryTime,
  THROTTLE_FRAMES_PER_SEC,
  ZOOM_STEP,
} from "../../utils/constants";
import {
  decodeQrData,
} from "../../utils/dataProcessor";
import { readBarcodes } from "zxing-wasm/full";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";
import { Slider } from "@mui/material";
import "./QRCodeVerification.css";

// --- ADDITIVE CHANGE: Import new dependencies for offline mode ---
import { CredentialsVerifier } from '../../services/offline-verifier/CredentialsVerifier';
import { CredentialFormat } from '../../services/offline-verifier/constants/CredentialFormat';
import { VerificationResult } from '../../services/offline-verifier/data/data';

// Simplified, single-mode props (offline-style) that works for both offline and online QR payloads
export interface QRCodeVerificationProps {
  triggerElement?: React.ReactNode;
  onError: (error: Error) => void;
  isEnableUpload?: boolean;
  isEnableScan?: boolean;
  uploadButtonId?: string;
  uploadButtonStyle?: string;
  isEnableZoom?: boolean;
  onVerificationResult: (result: VerificationResult) => void;
  credentialFormat?: CredentialFormat; // Optional, defaults to LDP_VC
}


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

  // Basic prop validation
  if (!onError) throw new Error("onError callback is required.");
  if (!props.onVerificationResult) throw new Error("onVerificationResult is required.");

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
    if (!isEnableScan || isCameraActive || streamingRef.current) {
      return;
    }
    
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
        setIsCameraActive(true); // Set camera active when stream is successfully obtained
        const video = videoRef.current;
        if (!video) {
          return;
        }
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
            .catch((playError) => {
              onError(playError);
            });
        };
      })
      .catch((streamError) => {
        onError(streamError);
      });
  }, [isEnableScan, isCameraActive, onError, processFrame]);

  const stopVideoStream = () => {
    streamingRef.current = false;
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
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

  // Accept unknown (string expected; object not supported here)
  async function processScanResult(rawInput: unknown) {
    try {
      // Debounce identical scans for strings only
      if (typeof rawInput === 'string' && rawInput === lastProcessedRef.current) {
        return;
      }
      if (typeof rawInput === 'string') {
        lastProcessedRef.current = rawInput;
      }

      // We support only string QR payloads here
      if (typeof rawInput !== 'string') {
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

        try {
          decodedRaw = await decodeQrData(new TextEncoder().encode(rawInput));
          if (decodedRaw) {
            parsed = JSON.parse(decodedRaw);
          } else {
            throw new Error('Decoded QR is null');
          }
        } catch (decodeError) {
          // Decoding failed: surface error once and exit
          if (rawInput !== lastErrorRef.current) {
            props.onError?.(new Error('QR is not a JSON VC payload'));
            lastErrorRef.current = rawInput;
          }
          return;
        }
      }

      // Reset lastError when we get a good JSON next
      lastErrorRef.current = null;

      // Single-path verification (offline-style)
      // Now that we have a valid VC object, stop the camera and show loader
      clearTimer();
      stopVideoStream();
      setScanning(true);

      try {
        const verifier = new CredentialsVerifier();
        const format = props.credentialFormat ?? CredentialFormat.LDP_VC;
        const payload = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
        const result = await verifier.verify(payload, format);

        // Ensure the VerificationResult carries the parsed credential for UI rendering
        const parsedObject = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        const hasResultShape = result && typeof result === 'object' && 'verificationStatus' in result;
        if (hasResultShape) {
          const r = result as VerificationResult & { payload?: any };
          if (!r.payload) {
            r.payload = parsedObject;
          }
          props.onVerificationResult?.(r as VerificationResult);
        } else {
          // Backward-compatibility: wrap boolean into VerificationResult and attach payload
          const wrapped = new VerificationResult(!!result, !!result ? 'Verification successful' : 'Verification failed', '');
          wrapped.payload = parsedObject;
          props.onVerificationResult?.(wrapped);
        }
      } finally {
        // Bring scanner back for next scan
        setScanning(false);
        setUploading(false);
        setLoading(false);
        setIsCameraActive(true);
        startVideoStream();
      }

    } catch (e: any) {
      props.onError?.(e instanceof Error ? e : new Error('QR processing error'));
    }
  }

  const handleError = (error: unknown) => {
    const errResult = new VerificationResult(false, (error as Error).message, 'PROCESS_ERROR');
    props.onVerificationResult(errResult);
  };

  // --- NO CHANGE HERE: All zoom and effect hooks are preserved ---
  const handleZoomChange = (value: number) => { if (value >= 0 && value <= 10) setZoomLevel(value); };
  const handleSliderChange = (_: any, value: number | number[]) => { if (typeof value === "number") handleZoomChange(value); };
  useEffect(() => { 
    if (!isEnableScan) {
      return;
    }
    
    
    startVideoStream(); 
    
  
    timerRef.current = setTimeout(() => { 
      stopVideoStream(); 
      onError(new Error("scanSessionExpired")); 
    }, ScanSessionExpiryTime); 
    
    return () => { 
      clearTimer(); 
      stopVideoStream(); 
    }; 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnableScan, isUploading]);
  useEffect(() => { const resize = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", resize); resize(); return () => window.removeEventListener("resize", resize); }, []);
  // Removed online redirect hash handling

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

