// One WebGL renderer for the whole session (the canvas is reused across jobs).
import * as THREE from 'three';

let R = null;
export function getRenderer(stage) {
  if (R) return R;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' });
  stage.prepend(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.setClearColor(0x05070b, 1);
  R = renderer;
  return R;
}

// A rough first guess at quality; adaptive resolution does the rest.
export function guessQuality(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
    if (/swiftshader|llvmpipe|software/.test(name)) return 'low';
    // Safari can mask the GPU name, and Retina fill rate matters even on Apple Silicon.
    if (/mac/i.test(navigator.platform) || /apple/.test(name)) return 'medium';
    if (/rtx|radeon rx|geforce gtx 1[06-9]|apple m[1-9] (pro|max|ultra)|apple m[3-9]/.test(name)) return 'high';
    return 'medium';
  } catch { return 'medium'; }
}

export function supportsHDR(renderer) {
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return false;
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}
