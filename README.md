# Green Screener Web

A professional-grade web-based green screen and blue screen analyzer for real-time visualization of screen evenness, color quality, and chroma keying performance.

## 🎬 Features

### Core Visualization Modes

#### 📊 Banding Mode (Default)
- Displays green intensity as grayscale bands
- Smooth gradients indicate even lighting
- Sharp jumps or patches reveal uneven areas
- Useful for quick visual assessment of screen uniformity

#### 🌡️ Heatmap Mode
- Color-coded saturation evenness visualization
- **Green**: Excellent saturation (>80%) - Perfect evenness
- **Yellow**: Good saturation (60-80%) - Good evenness
- **Orange**: Fair saturation (40-60%) - Moderate unevenness
- **Red**: Poor saturation (<40%) - Significant unevenness
- Essential for identifying hot spots and cold spots

#### 🔍 Analyze Mode
- Real-time color spill detection and quantification
- **Cyan pixels**: Good chroma areas (low spill ratio)
- **Magenta/Pink pixels**: Color spill detected (high spill ratio)
- **Spill percentage**: Quantifies the amount of detected spill
- Adjustable sensitivity threshold (10-90%)

#### 👁️ Preview Mode
- Live compositing with background images
- Automatic chroma key removal based on HSV color space detection
- Perfect for testing how your green screen looks with actual backgrounds
- Load any image as background

### Color Analysis

- **Hue**: Average hue angle (0-360°) of detected green/blue screen
- **Saturation**: Average color saturation (0-100%)
- **Value**: Average brightness (0-100%)
- Real-time statistics displayed on-screen

### Image & Background Management

- **Load Background**: Import any image for composite preview
- **Clear Background**: Remove loaded background instantly
- **Save Snapshot**: Export current visualization as PNG

### Camera Controls

#### Transform Controls
- **Zoom**: 0.5x - 3.0x magnification
- **Pan**: Move camera view up, down, left, right
- **Reset Pan**: Return to original position

#### Flip Controls
- **Flip X**: Mirror horizontally
- **Flip Y**: Mirror vertically
- Useful for setting up camera orientation

### Video Processing

- **Exposure**: 0.2x - 3.0x gain adjustment for banding mode
- **Sensitivity**: 10-90% threshold for spill detection
- **Playback**: Pause/Resume live analysis
- Real-time frame processing at camera refresh rate

## 🚀 Getting Started

### Installation

```bash
cd green-screener-web
npm install
```

### Development

```bash
npm run dev
```

Starts the development server at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Creates an optimized production build in the `dist/` directory

### Preview Production Build

```bash
npm run preview
```

## 📱 System Requirements

- Modern web browser with WebRTC support
- Camera/webcam access
- JavaScript enabled
- Minimum screen resolution: 1024x768 (recommended 1440x900+)

## 🎯 How to Use Green Screener

### Step 1: Point Your Camera
Set up your camera to view your green screen setup. Allow camera access when prompted.

### Step 2: Choose Visualization Mode
- **Start with Banding**: For quick visual assessment of evenness
- **Switch to Heatmap**: For detailed saturation analysis
- **Use Analyze**: To detect and measure color spill
- **Try Preview**: To see live compositing results

### Step 3: Adjust Settings
- **Exposure**: Increase if the screen looks too dark
- **Sensitivity**: Adjust based on your screen's color saturation
- **Zoom**: Get closer to problem areas
- **Pan**: Move around the screen to check different zones

### Step 4: Identify Problem Areas
- In **Banding mode**: Look for sharp transitions (uneven lighting)
- In **Heatmap mode**: Red/orange areas indicate poor evenness
- In **Analyze mode**: High spill % indicates color bleed issues

### Step 5: Make Adjustments
- Adjust lighting to smooth out banding
- Use diffusers to even out saturation
- Check spill levels when cameras are placed close to the screen

### Step 6: Save Results
Use "Save Snapshot" to document your setup for reference

## 🔬 Technical Details

### Color Detection Algorithm

Uses HSV (Hue, Saturation, Value) color space analysis:

- **Green Screen**: Hue 90-150° (120° ± 30°)
- **Blue Screen**: Hue 210-270° (240° ± 30°)
- **Detection Threshold**: Saturation > 20%, Value > 20%

### Spill Detection

Calculated as:
```
spillRatio = (greenChannel - max(redChannel, blueChannel)) / greenChannel
```

Spill is detected when `spillRatio > sensitivityThreshold`

### Performance

- Real-time processing at camera frame rate
- Optimized pixel-by-pixel operations
- Canvas 2D rendering
- ~60 FPS on modern hardware

## 🛠️ Technologies

- **React 19**: UI framework
- **Vite 7**: Build tool and dev server
- **Canvas API**: Real-time image processing
- **WebRTC MediaDevices API**: Camera access
- **HSV Color Space**: Color analysis

## 📚 Project Structure

```
green-screener-web/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Component-specific styles
│   ├── index.css        # Global styles
│   ├── main.jsx         # React entry point
│   └── assets/          # Static assets
├── public/
│   ├── manifest.webmanifest
│   └── robots.txt
├── package.json
├── vite.config.js
└── README.md
```

## 🎓 Educational Use

Perfect for understanding:
- Color space conversions (RGB to HSV)
- Real-time video processing
- Chroma keying principles
- Canvas API for pixel manipulation
- React hooks and state management

## 🔐 Privacy

- All processing happens locally in your browser
- No data is sent to any server
- No tracking or analytics
- Camera stream exists only in memory

## 📝 License

This project is a modern web-based reverse engineering and reimplementation of the professional Green Screener application.

## 🙏 Credits

Built as a modern, open-source alternative to the original Green Screener desktop application for analyzing green and blue screen lighting quality and chroma key performance.

---

**Status**: Fully functional for professional green/blue screen analysis
