import React, { useEffect, useRef, useState } from 'react';

const constraints = {
  video: {
    facingMode: 'user',
  },
  audio: false,
};

// Color analysis utilities
const ColorAnalyzer = {
  rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const v = max;

    if (max !== min) {
      const d = max - min;
      s = d / max;
      if (max === r) {
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / d + 2) / 6;
      } else {
        h = ((r - g) / d + 4) / 6;
      }
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
  },

  // Green screen detection (hue 120±30 degrees)
  isGreenScreen(h, s, v) {
    return h >= 90 && h <= 150 && s > 20 && v > 20;
  },

  // Blue screen detection (hue 240±30 degrees)
  isBlueScreen(h, s, v) {
    return (h >= 210 && h <= 270) && s > 20 && v > 20;
  },
};

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const bgCanvasRef = useRef(null);
  
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [exposure, setExposure] = useState(1.0);
  const [mode, setMode] = useState('banding');
  const [zoom, setZoom] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [bgImage, setBgImage] = useState(null);
  const [colorStats, setColorStats] = useState(null);
  const [spillAmount, setSpillAmount] = useState(0);
  const [sensitivity, setSensitivity] = useState(50);

  // Camera initialization
  useEffect(() => {
    let stream;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasCamera(true);
          setRunning(true);
        }
      } catch (err) {
        console.error(err);
        setError('Camera access denied or not available.');
      }
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      void initCamera();
    } else {
      setError('MediaDevices API not supported in this browser.');
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Handle background image upload
  const handleBgImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setBgImage(img);
        };
        img.src = event.target?.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle screenshot
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `green-screen-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
  };

  // Main render loop
  useEffect(() => {
    let animationId;

    function renderFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        animationId = requestAnimationFrame(renderFrame);
        return;
      }

      const ctx = canvas.getContext('2d');
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      if (width === 0 || height === 0) {
        animationId = requestAnimationFrame(renderFrame);
        return;
      }

      canvas.width = width;
      canvas.height = height;

      // Apply transforms
      ctx.save();
      ctx.translate(width / 2, height / 2);
      if (flipX) ctx.scale(-1, 1);
      if (flipY) ctx.scale(1, -1);
      ctx.scale(zoom, zoom);
      ctx.translate(offsetX, offsetY);
      ctx.translate(-width / 2, -height / 2);

      // Draw video frame
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();

      // Get pixel data
      const frame = ctx.getImageData(0, 0, width, height);
      const data = frame.data;

      let greenStats = { count: 0, sumH: 0, sumS: 0, sumV: 0 };
      let spillPixels = 0;
      const sensitivityThreshold = sensitivity / 100;

      if (mode === 'banding') {
        // Original banding visualization
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const greenness = Math.max(g - r, 0) + Math.max(g - b, 0);
          let value = greenness * exposure;
          if (value > 255) value = 255;

          const bands = 8;
          const bandSize = 256 / bands;
          const bandIndex = Math.floor(value / bandSize);
          const bandValue = bandIndex * bandSize;

          data[i] = bandValue;
          data[i + 1] = bandValue;
          data[i + 2] = bandValue;
          data[i + 3] = 255;
        }
      } else if (mode === 'heatmap') {
        // Saturation/evenness heatmap
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const hsv = ColorAnalyzer.rgbToHsv(r, g, b);
          const isGreen = ColorAnalyzer.isGreenScreen(hsv.h, hsv.s, hsv.v);
          const isBlue = ColorAnalyzer.isBlueScreen(hsv.h, hsv.s, hsv.v);

          if (isGreen || isBlue) {
            greenStats.count++;
            greenStats.sumH += hsv.h;
            greenStats.sumS += hsv.s;
            greenStats.sumV += hsv.v;

            // Color code by saturation (evenness)
            if (hsv.s > 80) {
              data[i] = 0;       // R
              data[i + 1] = 255; // G (bright green = excellent evenness)
              data[i + 2] = 0;   // B
            } else if (hsv.s > 60) {
              data[i] = 255;    // R (yellow = good)
              data[i + 1] = 255; // G
              data[i + 2] = 0;   // B
            } else if (hsv.s > 40) {
              data[i] = 255;     // R (orange = fair)
              data[i + 1] = 165; // G
              data[i + 2] = 0;   // B
            } else {
              data[i] = 255;     // R (red = uneven)
              data[i + 1] = 0;   // G
              data[i + 2] = 0;   // B
            }
            data[i + 3] = 200;
          } else {
            // Non-green areas shown as darker
            data[i] = Math.floor(data[i] * 0.3);
            data[i + 1] = Math.floor(data[i + 1] * 0.3);
            data[i + 2] = Math.floor(data[i + 2] * 0.3);
            data[i + 3] = 128;
          }
        }
      } else if (mode === 'preview' && bgImage) {
        // Composite with background
        const bgCanvas = bgCanvasRef.current;
        if (bgCanvas) {
          bgCanvas.width = width;
          bgCanvas.height = height;
          const bgCtx = bgCanvas.getContext('2d');
          bgCtx.drawImage(bgImage, 0, 0, width, height);
          const bgData = bgCtx.getImageData(0, 0, width, height).data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const hsv = ColorAnalyzer.rgbToHsv(r, g, b);
            const isGreen = ColorAnalyzer.isGreenScreen(hsv.h, hsv.s, hsv.v);

            if (!isGreen) {
              data[i] = bgData[i];
              data[i + 1] = bgData[i + 1];
              data[i + 2] = bgData[i + 2];
            }
          }
        }
      } else if (mode === 'analyze') {
        // Spill analysis and statistics
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const hsv = ColorAnalyzer.rgbToHsv(r, g, b);
          const isGreen = ColorAnalyzer.isGreenScreen(hsv.h, hsv.s, hsv.v);
          const isBlue = ColorAnalyzer.isBlueScreen(hsv.h, hsv.s, hsv.v);

          if (isGreen || isBlue) {
            greenStats.count++;
            greenStats.sumH += hsv.h;
            greenStats.sumS += hsv.s;
            greenStats.sumV += hsv.v;

            // Detect color spill (green channel dominates too much)
            const maxChannel = Math.max(r, b);
            const spillRatio = maxChannel > 0 ? (g - maxChannel) / g : 0;
            
            if (spillRatio > sensitivityThreshold) {
              spillPixels++;
              // Spill indicator (magenta/pink for spill areas)
              data[i] = 255;
              data[i + 1] = 0;
              data[i + 2] = 200;
            } else {
              // Good chroma (cyan for good areas)
              data[i] = 0;
              data[i + 1] = 255;
              data[i + 2] = 255;
            }
            data[i + 3] = 200;
          } else {
            data[i] = Math.floor(data[i] * 0.2);
            data[i + 1] = Math.floor(data[i + 1] * 0.2);
            data[i + 2] = Math.floor(data[i + 2] * 0.2);
            data[i + 3] = 100;
          }
        }
        if (greenStats.count > 0) {
          const spillPercent = (spillPixels / greenStats.count) * 100;
          setSpillAmount(spillPercent);
        }
      }

      ctx.putImageData(frame, 0, 0);

      if (greenStats.count > 0) {
        setColorStats({
          avgH: greenStats.sumH / greenStats.count,
          avgS: greenStats.sumS / greenStats.count,
          avgV: greenStats.sumV / greenStats.count,
          detectedPixels: greenStats.count,
        });
      }

      if (running) {
        animationId = requestAnimationFrame(renderFrame);
      }
    }

    if (running) {
      animationId = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [running, exposure, mode, bgImage, flipX, flipY, zoom, offsetX, offsetY, sensitivity]);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Green Screener Web</h1>
        <p className="subtitle">Professional green/blue screen analyzer</p>
      </header>

      <main className="app-main">
        <div className="video-wrapper">
          {!hasCamera && !error && <p className="loading">Initializing camera…</p>}
          {error && <p className="error">{error}</p>}

          <video
            ref={videoRef}
            className="hidden-video"
            playsInline
            muted
          />

          <canvas ref={canvasRef} className="preview-canvas" />
          <canvas ref={bgCanvasRef} className="hidden-canvas" />

          {colorStats && (
            <div className="color-stats">
              <div className="stat-item">
                <strong>Hue:</strong> {colorStats.avgH.toFixed(1)}°
              </div>
              <div className="stat-item">
                <strong>Saturation:</strong> {colorStats.avgS.toFixed(1)}%
              </div>
              <div className="stat-item">
                <strong>Value:</strong> {colorStats.avgV.toFixed(1)}%
              </div>
              {mode === 'analyze' && (
                <div className="stat-item spill-stat">
                  <strong>Spill:</strong> {spillAmount.toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>

        <div className="controls">
          <div className="control-group">
            <h3>Playback</h3>
            <button 
              className={`btn ${running ? 'active' : ''}`}
              onClick={() => setRunning((v) => !v)}
            >
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
          </div>

          <div className="control-group">
            <h3>Visualization Mode</h3>
            <div className="mode-buttons">
              {['banding', 'heatmap', 'analyze', 'preview'].map((m) => (
                <button
                  key={m}
                  className={`btn mode-btn ${mode === m ? 'active' : ''}`}
                  onClick={() => setMode(m)}
                  disabled={m === 'preview' && !bgImage}
                >
                  {m === 'banding' && '📊 Banding'}
                  {m === 'heatmap' && '🌡️ Heatmap'}
                  {m === 'analyze' && '🔍 Analyze'}
                  {m === 'preview' && '👁️ Preview'}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <h3>Exposure</h3>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={exposure}
              onChange={(e) => setExposure(parseFloat(e.target.value))}
              className="slider"
            />
            <span className="value-label">{exposure.toFixed(1)}x</span>
          </div>

          <div className="control-group">
            <h3>Sensitivity</h3>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="slider"
            />
            <span className="value-label">{sensitivity}%</span>
          </div>

          <div className="control-group">
            <h3>Zoom</h3>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="slider"
            />
            <span className="value-label">{zoom.toFixed(1)}x</span>
          </div>

          <div className="control-group">
            <h3>Pan</h3>
            <div className="pan-controls">
              <button 
                className="btn arrow-btn"
                onClick={() => setOffsetX(offsetX - 10)}
              >
                ←
              </button>
              <button 
                className="btn arrow-btn"
                onClick={() => setOffsetY(offsetY - 10)}
              >
                ↑
              </button>
              <button 
                className="btn arrow-btn"
                onClick={() => setOffsetX(offsetX + 10)}
              >
                →
              </button>
              <button 
                className="btn arrow-btn"
                onClick={() => setOffsetY(offsetY + 10)}
              >
                ↓
              </button>
              <button 
                className="btn"
                onClick={() => {
                  setOffsetX(0);
                  setOffsetY(0);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="control-group">
            <h3>Flip</h3>
            <div className="flip-controls">
              <button 
                className={`btn ${flipX ? 'active' : ''}`}
                onClick={() => setFlipX(!flipX)}
              >
                ↔️ Flip X
              </button>
              <button 
                className={`btn ${flipY ? 'active' : ''}`}
                onClick={() => setFlipY(!flipY)}
              >
                ↕️ Flip Y
              </button>
            </div>
          </div>

          <div className="control-group">
            <h3>Background</h3>
            <button 
              className="btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Load Background
            </button>
            {bgImage && (
              <button 
                className="btn danger"
                onClick={() => setBgImage(null)}
              >
                ✕ Clear Background
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBgImageUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="control-group">
            <h3>Export</h3>
            <button 
              className="btn success"
              onClick={takeSnapshot}
            >
              📸 Save Snapshot
            </button>
          </div>
        </div>

        <section className="info">
          <h2>How to Use</h2>
          <ul>
            <li>
              <strong>Banding Mode:</strong> Grayscale bands show green intensity. Smooth gradients = even lighting; sharp jumps = uneven areas.
            </li>
            <li>
              <strong>Heatmap Mode:</strong> Green = excellent, Yellow = good, Orange = fair, Red = uneven saturation.
            </li>
            <li>
              <strong>Analyze Mode:</strong> Cyan = good chroma, Magenta = color spill detected. Lower spill % is better.
            </li>
            <li>
              <strong>Preview Mode:</strong> Load a background image to see live compositing with chroma key removal.
            </li>
            <li>
              <strong>Sensitivity:</strong> Adjust spill detection threshold for your specific setup.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
