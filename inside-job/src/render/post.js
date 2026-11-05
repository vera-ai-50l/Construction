// Optional HDR grade. Low and GPUs without a renderable HDR target draw
// straight to the backbuffer with Three's exposure and tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { supportsHDR } from './gfx.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1.0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uVig: { value: 0.55 }, uGrain: { value: 0.022 }, uCA: { value: 0.0035 }, uAlarm: { value: 0 }, uSeen: { value: 0 }, uDesat: { value: 0 },
    uLift: { value: new THREE.Vector3(0.012, 0.018, 0.03) }, uGain: { value: new THREE.Vector3(1.03, 1.0, 0.95) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uExposure, uTime, uVig, uGrain, uCA, uAlarm, uSeen, uDesat; uniform vec2 uRes;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;
    vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 IN = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
      const mat3 OUT = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
      c = IN * (c / 0.6); c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * uCA * (0.4 + 2.5 * r2);
      vec3 c = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
      c *= uExposure;
      c = aces(c);
      // grade: lift shadows toward cold teal, warm the highlights slightly
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.0 - uDesat);
      c = c * uGain + uLift * (1.0 - l);
      // vignette
      c *= 1.0 - uVig * smoothstep(0.08, 0.62, r2 * 1.6);
      // alarm (red pulse at the edges) and "being seen" (desaturated red rim)
      float edge = smoothstep(0.05, 0.5, r2 * 1.9);
      c = mix(c, vec3(0.85, 0.06, 0.04) * (0.4 + l), uAlarm * edge * 0.55);
      c = mix(c, vec3(1.0, 0.25, 0.1) * (0.3 + l), uSeen * edge * 0.45);
      c = toSRGB(clamp(c, 0.0, 1.0));
      c += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.u = THREE.UniformsUtils.clone(FinalShader.uniforms);
    if (quality === 'low' || !supportsHDR(renderer)) return;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    if (quality === 'high') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.22, 1.5);
      this.composer.addPass(this.bloom);
    }
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.u = this.final.uniforms;
    if (quality === 'medium') this.u.uCA.value = 0;
  }
  setSize(w, h) {
    if (this.composer) this.composer.setSize(w, h);
    this.u.uRes.value.set(w, h);
  }
  render(dt) {
    this.u.uTime.value += dt;
    const r = this.renderer;
    if (this.composer) {
      r.toneMapping = THREE.NoToneMapping;
      this.composer.render(dt);
    } else {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = this.u.uExposure.value * 1.45;
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
    }
  }
  dispose() {
    this.composer?.dispose();
    this.bloom?.dispose();
    this.final?.dispose();
  }
}
