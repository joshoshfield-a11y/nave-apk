// N A V E — house postFX chain: bright-pass -> separable blur -> composite
// (ACES approx + vignette + chromatic aberration + grain). Owned stack, no deps.
const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform float threshold; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(threshold, threshold + 0.55, l);
  gl_FragColor = vec4(c * w, 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec3 acc = texture2D(tSrc, vUv).rgb * 0.227027;
  vec2 o1 = dir * 1.3846153846, o2 = dir * 3.2307692308;
  acc += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162162;
  acc += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702702703;
  gl_FragColor = vec4(acc, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float bloomStrength; uniform float time; uniform vec2 resolution;
varying vec2 vUv;
vec3 aces(vec3 x){
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  float ca = 0.0012 * r2 * 4.0;
  vec3 scene;
  scene.r = texture2D(tScene, uv + centered * ca).r;
  scene.g = texture2D(tScene, uv).g;
  scene.b = texture2D(tScene, uv - centered * ca).b;
  vec3 bloom = texture2D(tBloom, uv).rgb;
  vec3 col = scene + bloom * bloomStrength;
  col = aces(col * 1.05);
  col *= 1.0 - smoothstep(0.15, 0.85, r2 * 1.9) * 0.55;
  col += (hash(uv * resolution + fract(time) * 100.0) - 0.5) * 0.012;
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}`;

class PostFX {
  constructor(renderer, { threshold = 0.55, bloomStrength = 1.15, scale = 0.5 } = {}) {
    this.renderer = renderer;
    this.threshold = threshold; this.bloomStrength = bloomStrength;
    const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    const bOpts = { ...rtOpts, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, bOpts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, bOpts);
    this.scale = scale;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: frag, uniforms,
      depthTest: false, depthWrite: false });
    this.brightMat = mk(BRIGHT_FRAG, { tSrc: { value: null }, threshold: { value: threshold } });
    this.blurMat = mk(BLUR_FRAG, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.compMat = mk(COMPOSITE_FRAG, { tScene: { value: null }, tBloom: { value: null },
      bloomStrength: { value: bloomStrength }, time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) } });
  }
  setSize(w, h) {
    this.rtScene.setSize(w, h);
    const bw = Math.max(2, Math.floor(w * this.scale)), bh = Math.max(2, Math.floor(h * this.scale));
    this.rtA.setSize(bw, bh); this.rtB.setSize(bw, bh);
    this.compMat.uniforms.resolution.value.set(w, h);
  }
  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }
  render(scene, camera, time) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    this.brightMat.uniforms.tSrc.value = this.rtScene.texture;
    this._pass(this.brightMat, this.rtA);
    for (let i = 0; i < 2; i++) {
      this.blurMat.uniforms.tSrc.value = this.rtA.texture;
      this.blurMat.uniforms.dir.value.set(1 / this.rtA.width, 0);
      this._pass(this.blurMat, this.rtB);
      this.blurMat.uniforms.tSrc.value = this.rtB.texture;
      this.blurMat.uniforms.dir.value.set(0, 1 / this.rtA.height);
      this._pass(this.blurMat, this.rtA);
    }
    this.compMat.uniforms.tScene.value = this.rtScene.texture;
    this.compMat.uniforms.tBloom.value = this.rtA.texture;
    this.compMat.uniforms.time.value = time;
    this._pass(this.compMat, null);
  }
}

window.PostFX = PostFX;
