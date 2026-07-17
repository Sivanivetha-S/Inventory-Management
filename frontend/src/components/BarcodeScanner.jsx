import React, { useState, useEffect, useRef } from 'react'
import { Camera, ScanLine } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BarcodeScanner({ onScan, action = 'SEARCH' }) {
  const [scanning, setScanning] = useState(false)
  const [barcodeIndicator, setBarcodeIndicator] = useState('')
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const lastScannedBarcodeRef = useRef('')
  const lastScanTimeRef = useRef(0)

  // Debug Panel States
  const [debugCamStatus, setDebugCamStatus] = useState('Off')
  const [debugReaderStatus, setDebugReaderStatus] = useState('Idle')
  const [debugFramesCount, setDebugFramesCount] = useState(0)
  const [debugDetected, setDebugDetected] = useState('No')
  const [debugLastBarcode, setDebugLastBarcode] = useState('')

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error('Beep failed', e);
    }
  }

  const startScanning = async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')

      console.log('Scanner Started')
      setDebugCamStatus('Initializing')
      setDebugReaderStatus('Initializing')
      setDebugFramesCount(0)
      setDebugDetected('No')
      setDebugLastBarcode('')

      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      setScanning(true)
      setBarcodeIndicator('🔍 Scanning...')
      toast.success('Camera started — point at a barcode')

      // Wait for the video element to be ready
      await new Promise(resolve => setTimeout(resolve, 300))
      if (!videoRef.current) {
        toast.error('Video element not ready')
        setScanning(false)
        setDebugCamStatus('Error')
        setDebugReaderStatus('Stopped')
        return
      }

      console.log('Camera Ready')
      console.log('Waiting for Barcode')
      setDebugCamStatus('Active')
      setDebugReaderStatus('Scanning')

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          focusMode: 'continuous'
        },
        audio: false
      }

      // Continuous scanning from default webcam device using constraints
      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        async (result, error) => {
          console.log('Frame Received')
          setDebugFramesCount(c => {
            const next = c + 1
            if (next % 25 === 0) {
              const warnings = [
                '🔍 Move Closer',
                '🔍 Improve Lighting',
                '🔍 Hold Camera Steady',
                '🔍 Barcode Too Small'
              ]
              const idx = Math.floor((next / 25) % warnings.length)
              setBarcodeIndicator(warnings[idx])
            }
            return next
          })

          if (result) {
            const code = result.getText()
            console.log('Barcode Detected')
            console.log('Decoded Value:', code)

            setBarcodeIndicator('✅ Barcode Detected')
            setDebugDetected('Yes')
            setDebugLastBarcode(code)
            playBeep()

            // Debounce: ignore same barcode scanned within 2 seconds
            const now = Date.now()
            if (code && lastScannedBarcodeRef.current === code && now - lastScanTimeRef.current < 2000) {
              return
            }
            lastScannedBarcodeRef.current = code
            lastScanTimeRef.current = now

            // Invoke callback in parent
            if (onScan) {
              onScan(code)
            }
          }
        }
      )

      controlsRef.current = controls
    } catch (err) {
      console.error('[ZXing] Camera error:', err)
      toast.error('Could not access camera: ' + err.message)
      setScanning(false)
      setDebugCamStatus('Error')
      setDebugReaderStatus('Stopped')
    }
  }

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setScanning(false)
    setBarcodeIndicator('')
    toast.success('Camera stopped')
    setDebugCamStatus('Off')
    setDebugReaderStatus('Idle')
  }

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontWeight: 600, fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ScanLine size={16} style={{ color: 'var(--accent)' }} />
          Webcam Barcode Scanner ({action})
        </h3>
        {scanning ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={stopScanning} style={{ borderColor: 'var(--err)', color: 'var(--err)' }}>
            Stop Scanning
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={startScanning}>
            <Camera size={14} /> Scan Barcode
          </button>
        )}
      </div>

      {scanning && (
        <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

          {/* Green scanning rectangle overlay - center 50% */}
          <div style={{
            position: 'absolute',
            top: '25%', left: '25%',
            width: '50%', height: '50%',
            border: '2.5px solid #00ff88',
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
            zIndex: 2
          }}>
            {/* Corner markers */}
            <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: '3px solid #00ff88', borderLeft: '3px solid #00ff88', borderRadius: '6px 0 0 0' }} />
            <div style={{ position: 'absolute', top: -1, right: -1, width: 20, height: 20, borderTop: '3px solid #00ff88', borderRight: '3px solid #00ff88', borderRadius: '0 6px 0 0' }} />
            <div style={{ position: 'absolute', bottom: -1, left: -1, width: 20, height: 20, borderBottom: '3px solid #00ff88', borderLeft: '3px solid #00ff88', borderRadius: '0 0 0 6px' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: '3px solid #00ff88', borderRight: '3px solid #00ff88', borderRadius: '0 0 6px 0' }} />
          </div>

          {barcodeIndicator && (
            <div style={{ position: 'absolute', bottom: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '5px 12px', borderRadius: 4, fontSize: 12, zIndex: 3 }}>
              {barcodeIndicator}
            </div>
          )}
        </div>
      )}

      {scanning && (
        <div style={{
          marginTop: 10,
          padding: 12,
          background: 'rgba(0,0,0,0.85)',
          color: '#00ff88',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'monospace',
          lineHeight: 1.4,
          border: '1px solid #00ff88',
          zIndex: 4
        }}>
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: 4, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>🛠️ ZXING DEBUG PANEL</span>
            <span style={{ color: '#aaa', fontSize: 9 }}>v1.0.0</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px 12px' }}>
            <div>Camera Status: <span style={{ color: '#fff' }}>{debugCamStatus}</span></div>
            <div>Reader Status: <span style={{ color: '#fff' }}>{debugReaderStatus}</span></div>
            <div>Frames Received: <span style={{ color: '#fff' }}>{debugFramesCount}</span></div>
            <div>Barcode Detected: <span style={{ color: '#fff' }}>{debugDetected}</span></div>
            <div style={{ gridColumn: '1 / -1' }}>Last Barcode: <span style={{ color: '#fff' }}>{debugLastBarcode || 'None'}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
