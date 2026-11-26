/* Rei da Castanha — renderizador WebGL2.
   Pipeline estilo HD-2D: sprites pixel-art com iluminação dinâmica (normal maps),
   céu e névoa em shader, camadas de parallax pintadas, bloom em cadeia (dual filter),
   god rays em espaço de tela, tone mapping filmico, grading por humor, vinheta e grão. */
(function () {
  'use strict';
  const RC = window.RC;
  const WW = 960, WH = 540;                 // mundo lógico
  const FLOATS = 12;                        // x y u v r g b a emit lit flip fog
  const MAX_QUADS = 6000;

  const srgb2lin = (c) => Math.pow(c, 2.2);
  RC.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  RC.hexLin = (h) => RC.hex(h).map(srgb2lin);

  const GLSL_COMMON = `#version 300 es
precision highp float;
precision highp sampler2D;
`;

  const VS_SPRITE = GLSL_COMMON + `
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aMisc;
uniform vec4 uView;
out vec2 vUV; out vec4 vCol; out vec4 vMisc; out vec2 vWorld;
void main(){
  vUV = aUV; vCol = aCol; vMisc = aMisc; vWorld = aPos;
  gl_Position = vec4(aPos * uView.xy + uView.zw, 0.0, 1.0);
}`;

  const FS_SPRITE = GLSL_COMMON + `
in vec2 vUV; in vec4 vCol; in vec4 vMisc; in vec2 vWorld;
uniform sampler2D uAlbedo; uniform sampler2D uNormal;
uniform vec3 uAmbient; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uFog;
uniform int uNL; uniform vec4 uLP[8]; uniform vec3 uLC[8];
out vec4 o;
// amostragem "sharp bilinear" (point sampling antialiased): pixels firmes, bordas suavizadas só na transição
vec2 sharpUV(vec2 uv){
  vec2 sz = vec2(textureSize(uAlbedo, 0));
  vec2 px = uv * sz;
  vec2 box = clamp(fwidth(px), vec2(1e-4), vec2(1.0));
  vec2 tx = px - 0.5 * box;
  vec2 off = smoothstep(vec2(1.0) - box, vec2(1.0), fract(tx));
  return (floor(tx) + 0.5 + off) / sz;
}
void main(){
  vec2 suv = sharpUV(vUV);
  vec4 a = texture(uAlbedo, suv);
  if (a.a < 0.02) discard;
  vec3 alb = pow(a.rgb, vec3(2.2)) * vCol.rgb;
  vec3 n = texture(uNormal, suv).xyz * 2.0 - 1.0;
  n.x *= vMisc.z; n = normalize(n);
  vec3 lit = uAmbient + uSunCol * max(dot(n, uSunDir), 0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uNL) break;
    vec3 L = vec3(uLP[i].xy - vWorld, uLP[i].z);
    float d = length(L); L /= d;
    float att = clamp(1.0 - d / uLP[i].w, 0.0, 1.0); att *= att;
    lit += uLC[i] * max(dot(n, L), 0.0) * att;
  }
  vec3 c = alb * mix(vec3(1.0), lit, vMisc.y);
  c += alb * vMisc.x;
  c = mix(c, uFog, vMisc.w);
  o = vec4(c, a.a * vCol.a);
}`;

  const VS_FULL = GLSL_COMMON + `
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FS_SKY = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform vec3 uTop, uMid, uLow, uSunCol, uCloud, uStar;
uniform vec2 uSun; uniform float uTime, uCam, uSunSize, uStars, uMoon, uCloudAmt;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
void main(){
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);       // y=0 topo
  float ar = 16.0/9.0;
  vec3 c = mix(uTop, uMid, smoothstep(0.0, 0.55, uv.y));
  c = mix(c, uLow, smoothstep(0.35, 1.0, uv.y));
  vec2 sp = vec2((uv.x - (uSun.x - uCam * 0.025 / 960.0)) * ar, uv.y - uSun.y);
  float sd = length(sp);
  // estrelas
  if (uStars > 0.0) {
    vec2 g = (uv + vec2(uCam*0.00002, 0.0)) * vec2(160.0*ar, 160.0);
    vec2 gi = floor(g); float r = h21(gi);
    float st = step(0.985, r) * smoothstep(0.5, 0.0, length(fract(g)-0.5));
    st *= 0.6 + 0.4*sin(uTime*(1.0+r*3.0)+r*50.0);
    c += uStar * st * uStars * smoothstep(0.7, 0.2, uv.y);
  }
  // nuvens
  vec2 cp = vec2(uv.x*ar*2.2 + uCam*0.00006 + uTime*0.004, uv.y*4.2);
  float cl = fbm(cp + vec2(0.0, 1.3));
  float cm = smoothstep(0.5, 0.78, cl) * uCloudAmt * smoothstep(0.85, 0.25, uv.y);
  float cl2 = fbm(cp + vec2(0.07, 1.3 - 0.05));
  float edge = clamp((cl - cl2) * 9.0 + 0.5, 0.0, 1.0);
  vec3 ccol = mix(uCloud * 0.62, uCloud * 1.08, edge) + uSunCol * 0.35 * exp(-sd*2.2) * edge;
  c = mix(c, ccol, cm);
  // sol / lua
  float disc = smoothstep(uSunSize, uSunSize*0.86, sd);
  vec3 body = uSunCol * (uMoon > 0.5 ? (0.85 + 0.15*vn(sp*60.0)) : 1.0);
  if (uMoon > 0.5) c += uSunCol * (0.30 * exp(-sd*9.0) + 0.07 * exp(-sd*2.6)); else c += uSunCol * (0.55 * exp(-sd*4.2) + 0.25 * exp(-sd*1.4));
  c = mix(c, body * 1.6, disc);
  o = vec4(c, 1.0);
}`;

  const FS_LAYER = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uCamPar;       // camX*parallax, tileW
uniform vec2 uYR;           // yTop, height
uniform vec3 uDark, uLight, uFog, uRimCol; uniform float uFogAmt, uAlpha, uHaze, uRim, uRimDir;
void main(){
  float wx = vUV.x * 960.0 + uCamPar.x;
  float wy = (1.0 - vUV.y) * 540.0;
  vec2 uv = vec2(wx / uCamPar.y, (wy - uYR.x) / uYR.y);
  if (uv.y < 0.0 || uv.y > 1.0) discard;
  vec4 t = texture(uTex, uv);
  if (t.a < 0.01) discard;
  vec3 c = mix(uDark, uLight, t.r);
  // luz de contorno: borda voltada para o sol (alfa vizinho menor) ganha brilho
  if (uRim > 0.0) {
    vec2 off = vec2(uRimDir * 5.0 / uCamPar.y, 0.0);
    float edge = clamp(t.a - texture(uTex, uv + off).a, 0.0, 1.0) + clamp(t.r - texture(uTex, uv + off).r, 0.0, 1.0) * 0.35 * t.a;
    c += uRimCol * edge * uRim;
  }
  float g = clamp(uHaze + uFogAmt * smoothstep(0.0, 1.0, (wy - uYR.x) / uYR.y), 0.0, 1.0);
  c = mix(c, uFog, g);
  o = vec4(c, t.a * uAlpha);
}`;

  const FS_MOTES = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform vec3 uCol; uniform float uTime, uCam, uAmt; uniform int uLayers;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  // esporos/pólen em pixels inteiros (grade de 2 px) a deriva em 3 profundidades
  vec2 px = floor(vUV * vec2(960.0, 540.0) / 2.0) * 2.0;
  vec3 acc = vec3(0.0);
  for (int L = 0; L < 3; L++) {
    if (L >= uLayers) break;
    float fl = float(L);
    float cell = 54.0 + fl * 26.0, par = 0.5 + fl * 0.55, spd = 7.0 + fl * 9.0;
    vec2 p = px + vec2(uCam * par + uTime * spd, -uTime * (2.0 + fl * 3.0));
    p.y += sin(uTime * (0.5 + fl * 0.3) + floor(p.x / cell) * 1.7) * 9.0;
    vec2 id = floor(p / cell), f = p - id * cell;
    float h = h21(id + fl * 17.3);
    if (h > 0.55) continue;
    vec2 c = vec2(h21(id + 3.1), h21(id + 7.7)) * (cell - 4.0);
    vec2 d = abs(f - c);
    float sz = fl > 1.5 ? 4.0 : 2.0;
    float dot_ = step(max(d.x, d.y), sz - 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * (1.2 + h * 2.5) + h * 40.0);
    acc += uCol * dot_ * (0.5 + tw) * (0.7 + fl * 0.3);
  }
  o = vec4(acc * uAmt, 1.0);
}`;

  const FS_MIST = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform vec3 uFog; uniform float uTime, uCam, uAmt, uBand, uPar, uScale;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.1+vec2(3.1,1.7); a*=.5; } return s; }
void main(){
  float wx = vUV.x * 960.0 + uCam * uPar;
  float wy = (1.0 - vUV.y) * 540.0;
  float n = fbm(vec2(wx * 0.0035 * uScale + uTime * 0.012, wy * 0.012 * uScale + uTime * 0.004));
  float band = exp(-pow((wy - uBand) / 70.0, 2.0));
  float a = clamp((n - 0.28) * 1.7, 0.0, 1.0) * band * uAmt;
  o = vec4(uFog, a);
}`;

  const FS_BRIGHT = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr;
void main(){
  vec3 c = vec3(0.0);
  c += texture(uTex, vUV + uTexel * vec2(-1.0,-1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 1.0,-1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp((l - uThr) / (0.45), 0.0, 1.0); k = k*k*(3.0-2.0*k);
  o = vec4(c * k, 1.0);
}`;

  const FS_DOWN = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec3 c = texture(uTex, vUV).rgb * 4.0;
  c += texture(uTex, vUV + uTexel * vec2(-1.0,-1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 1.0,-1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 1.0, 1.0)).rgb;
  o = vec4(c / 8.0, 1.0);
}`;

  const FS_UP = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uW;
void main(){
  vec3 c = vec3(0.0);
  c += texture(uTex, vUV + uTexel * vec2(-1.0, 0.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 1.0, 0.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 0.0,-1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2( 0.0, 1.0)).rgb;
  c += texture(uTex, vUV + uTexel * vec2(-0.7,-0.7)).rgb * 0.5;
  c += texture(uTex, vUV + uTexel * vec2( 0.7,-0.7)).rgb * 0.5;
  c += texture(uTex, vUV + uTexel * vec2(-0.7, 0.7)).rgb * 0.5;
  c += texture(uTex, vUV + uTexel * vec2( 0.7, 0.7)).rgb * 0.5;
  o = vec4(c / 6.0 * uW, 1.0);
}`;

  const FS_COMP = GLSL_COMMON + `
in vec2 vUV; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uBloom;
uniform vec2 uSunUV; uniform vec3 uRayCol;
uniform float uBloomK, uRayK, uExposure, uContrast, uSat, uTime, uAberr, uFlash, uFade, uVig, uGrain, uDepthBlur;
uniform vec3 uShadow, uHigh, uFlashCol;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUV;
  vec2 cuv = uv - 0.5;
  float ab = uAberr * dot(cuv, cuv);
  vec3 sc;
  sc.r = texture(uScene, uv + cuv * ab).r;
  sc.g = texture(uScene, uv).g;
  sc.b = texture(uScene, uv - cuv * ab).b;
  // tilt-shift suave: desfoca topo e base usando o bloom como imagem borrada
  float ts = smoothstep(0.30, 0.0, uv.y) * 0.55 + smoothstep(0.80, 1.0, uv.y) * 0.45;
  vec3 bl = texture(uBloom, uv).rgb;
  sc = mix(sc, mix(sc, bl * 1.15, 0.65), ts * uDepthBlur);
  vec3 col = sc + bl * uBloomK;
  // god rays
  vec2 dir = (uSunUV - uv);
  vec3 rays = vec3(0.0);
  float w = 1.0;
  float jit = h21(gl_FragCoord.xy + fract(uTime * 3.0) * 41.0);
  vec2 p = uv + dir * 0.032 * jit;
  for (int i = 0; i < 28; i++) {
    p += dir * 0.032;
    vec3 s = texture(uBloom, p).rgb;
    float l = max(max(s.r,s.g),s.b);
    rays += s * smoothstep(0.55, 1.4, l) * w;
    w *= 0.93;
  }
  col += rays * uRayCol * uRayK * 0.05 * smoothstep(0.05, 0.62, uv.y);
  col *= uExposure;
  // grading
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);
  col = mix(col * uShadow, col * uHigh, smoothstep(0.0, 1.0, lum * 1.4));
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col = (col - 0.5) * uContrast + 0.5;
  // vinheta
  float v = smoothstep(0.95, 0.25, length(cuv * vec2(1.05, 1.0)));
  col *= mix(1.0 - uVig, 1.0, v);
  // grão de filme
  float g = h21(uv * vec2(1920.0, 1080.0) + fract(uTime) * 37.0) - 0.5;
  col += g * uGrain;
  col = mix(col, uFlashCol, uFlash);
  col *= uFade;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(log, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('Shader: ' + log);
    }
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  RC.createRenderer = function (canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 indisponível');
    const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    gl.getExtension('OES_texture_float_linear');

    const P = {
      sprite: program(gl, VS_SPRITE, FS_SPRITE),
      sky: program(gl, VS_FULL, FS_SKY),
      layer: program(gl, VS_FULL, FS_LAYER),
      mist: program(gl, VS_FULL, FS_MIST),
      motes: program(gl, VS_FULL, FS_MOTES),
      bright: program(gl, VS_FULL, FS_BRIGHT),
      down: program(gl, VS_FULL, FS_DOWN),
      up: program(gl, VS_FULL, FS_UP),
      comp: program(gl, VS_FULL, FS_COMP)
    };

    /* ----- texturas ----- */
    function makeTex(src, opt) {
      opt = opt || {};
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const lin = opt.linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.mip ? gl.LINEAR_MIPMAP_LINEAR : lin);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin);
      const wrapS = opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (opt.mip) gl.generateMipmap(gl.TEXTURE_2D);
      return { tex: t, w: src.width, h: src.height };
    }
    const flatNormalCanvas = document.createElement('canvas');
    flatNormalCanvas.width = flatNormalCanvas.height = 2;
    { const c = flatNormalCanvas.getContext('2d'); c.fillStyle = 'rgb(128,128,255)'; c.fillRect(0, 0, 2, 2); }
    const flatNormal = makeTex(flatNormalCanvas);
    function texSet(albedoCanvas, normalCanvas, opt) {
      return { a: makeTex(albedoCanvas, opt), n: normalCanvas ? makeTex(normalCanvas, opt) : flatNormal, w: albedoCanvas.width, h: albedoCanvas.height, hasNormal: !!normalCanvas };
    }
    function freeSet(s) { if (!s) return; gl.deleteTexture(s.a.tex); if (s.n !== flatNormal) gl.deleteTexture(s.n.tex); }

    /* ----- framebuffers ----- */
    function makeRT(w, h, filter) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { tex: t, fb: f, w, h };
    }
    let scene = null, bloom = [];
    function freeRT(r) { if (r) { gl.deleteTexture(r.tex); gl.deleteFramebuffer(r.fb); } }

    let VW = 1920, VH = 1080;
    function resize(h) {
      VH = h; VW = Math.round(h * 16 / 9);
      canvas.width = VW; canvas.height = VH;
      freeRT(scene); bloom.forEach(freeRT);
      scene = makeRT(VW, VH);
      bloom = [];
      let w = VW >> 1, hh = VH >> 1;
      for (let i = 0; i < 5; i++) { bloom.push(makeRT(Math.max(2, w), Math.max(2, hh))); w >>= 1; hh >>= 1; }
    }

    /* ----- batch de sprites ----- */
    const vbuf = new Float32Array(MAX_QUADS * 6 * FLOATS);
    let vcount = 0;
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vbuf.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
    const fullVao = gl.createVertexArray();

    const env = {
      ambient: [0.3, 0.3, 0.3], sunDir: [0.5, -0.5, 0.7], sunCol: [1, 1, 1], fog: [0.5, 0.5, 0.5]
    };
    const lights = [];
    let curSet = null, curBlend = 'alpha';
    let camX = 0, camY = 0, time = 0;
    let viewBound = false;

    function setBlend(mode) {
      if (mode === curBlend) return;
      flush(); curBlend = mode; applyBlend();
    }
    function applyBlend() {
      gl.enable(gl.BLEND);
      if (curBlend === 'add') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
      else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    function useSprite() {
      const pr = P.sprite;
      gl.useProgram(pr.p);
      gl.uniform4f(pr.u.uView, 2 / WW, -2 / WH, -1 - (camX * 2) / WW, 1 + (camY * 2) / WH);
      gl.uniform1i(pr.u.uAlbedo, 0); gl.uniform1i(pr.u.uNormal, 1);
      gl.uniform3fv(pr.u.uAmbient, env.ambient);
      gl.uniform3fv(pr.u.uSunDir, env.sunDir);
      gl.uniform3fv(pr.u.uSunCol, env.sunCol);
      gl.uniform3fv(pr.u.uFog, env.fog);
      const n = Math.min(8, lights.length);
      gl.uniform1i(pr.u.uNL, n);
      if (n) {
        const lp = new Float32Array(32), lc = new Float32Array(24);
        for (let i = 0; i < n; i++) {
          const L = lights[i];
          lp[i * 4] = L.x; lp[i * 4 + 1] = L.y; lp[i * 4 + 2] = L.z; lp[i * 4 + 3] = L.r;
          lc[i * 3] = L.c[0] * L.k; lc[i * 3 + 1] = L.c[1] * L.k; lc[i * 3 + 2] = L.c[2] * L.k;
        }
        gl.uniform4fv(pr.u.uLP, lp); gl.uniform3fv(pr.u.uLC, lc);
      }
    }

    function flush() {
      if (!vcount || !curSet) { vcount = 0; return; }
      useSprite();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curSet.a.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, curSet.n.tex);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vbuf, 0, vcount * FLOATS);
      gl.drawArrays(gl.TRIANGLES, 0, vcount);
      vcount = 0;
    }

    /* Quad genérico: cantos (x0,y0)=TL (x1,y1)=TR (x2,y2)=BR (x3,y3)=BL */
    function quad(set, c, u0, v0, u1, v1, col, emit, lit, flip, fog) {
      if (set !== curSet) { flush(); curSet = set; }
      if (vcount + 6 > MAX_QUADS * 6) flush();
      const r = col ? col[0] : 1, g = col ? col[1] : 1, b = col ? col[2] : 1, a = col && col.length > 3 ? col[3] : 1;
      const e = emit || 0, l = lit === undefined ? 1 : lit, f = flip || 1, fg = fog || 0;
      let o = vcount * FLOATS;
      const put = (x, y, u, v) => {
        vbuf[o++] = x; vbuf[o++] = y; vbuf[o++] = u; vbuf[o++] = v;
        vbuf[o++] = r; vbuf[o++] = g; vbuf[o++] = b; vbuf[o++] = a;
        vbuf[o++] = e; vbuf[o++] = l; vbuf[o++] = f; vbuf[o++] = fg;
      };
      put(c[0], c[1], u0, v0); put(c[2], c[3], u1, v0); put(c[4], c[5], u1, v1);
      put(c[0], c[1], u0, v0); put(c[4], c[5], u1, v1); put(c[6], c[7], u0, v1);
      vcount += 6;
    }

    /* Sprite alinhado a pixels do dispositivo. rect = {x,y,w,h} em texels no set. */
    function sprite(set, rect, dx, dy, scaleX, scaleY, o) {
      o = o || {};
      const sx = scaleX, sy = scaleY === undefined ? scaleX : scaleY;
      const w = rect.w * Math.abs(sx), h = rect.h * Math.abs(sy);
      let x0 = dx, y0 = dy;
      if (!o.noSnap) { x0 = Math.round(x0 * 2) / 2; y0 = Math.round(y0 * 2) / 2; }
      const flip = sx < 0 ? -1 : 1;
      let u0 = rect.x / set.w, u1 = (rect.x + rect.w) / set.w;
      const v0 = rect.y / set.h, v1 = (rect.y + rect.h) / set.h;
      if (flip < 0) { const t = u0; u0 = u1; u1 = t; }
      const sh = o.shear || 0;                // deslocamento do topo (balanço)
      let c;
      if (o.rot) {
        const cx = x0 + (o.px !== undefined ? o.px : w / 2), cy = y0 + (o.py !== undefined ? o.py : h / 2);
        const cs = Math.cos(o.rot), sn = Math.sin(o.rot);
        const pts = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
        c = [];
        for (const p of pts) {
          const rx = p[0] - cx, ry = p[1] - cy;
          c.push(cx + rx * cs - ry * sn, cy + rx * sn + ry * cs);
        }
      } else {
        c = [x0 + sh, y0, x0 + w + sh, y0, x0 + w, y0 + h, x0, y0 + h];
      }
      quad(set, c, u0, v0, u1, v1, o.col, o.emit, o.lit, flip, o.fog);
    }

    /* ----- quadro ----- */
    function begin(cx, cy, t) {
      camX = cx; camY = cy || 0; time = t;
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
      gl.viewport(0, 0, scene.w, scene.h);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      curBlend = 'alpha'; vcount = 0; curSet = null;
    }
    function full() { gl.bindVertexArray(fullVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

    function drawSky(m) {
      flush();
      gl.disable(gl.BLEND);
      const pr = P.sky; gl.useProgram(pr.p);
      gl.uniform3fv(pr.u.uTop, m.skyTop); gl.uniform3fv(pr.u.uMid, m.skyMid); gl.uniform3fv(pr.u.uLow, m.skyLow);
      gl.uniform3fv(pr.u.uSunCol, m.sunDisc); gl.uniform3fv(pr.u.uCloud, m.cloudCol); gl.uniform3fv(pr.u.uStar, [1, 1, 1]);
      gl.uniform2f(pr.u.uSun, m.sunPos[0], m.sunPos[1]);
      gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uCam, camX);
      gl.uniform1f(pr.u.uSunSize, m.sunSize); gl.uniform1f(pr.u.uStars, m.stars);
      gl.uniform1f(pr.u.uMoon, m.moon ? 1 : 0); gl.uniform1f(pr.u.uCloudAmt, m.clouds);
      full();
      applyBlend();
    }

    function drawLayer(set, par, tileW, yTop, h, m, o) {
      flush();
      const pr = P.layer; gl.useProgram(pr.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, set.a.tex);
      gl.uniform1i(pr.u.uTex, 0);
      gl.uniform2f(pr.u.uCamPar, camX * par, tileW);
      gl.uniform2f(pr.u.uYR, yTop, h);
      gl.uniform3fv(pr.u.uDark, o.dark); gl.uniform3fv(pr.u.uLight, o.light); gl.uniform3fv(pr.u.uFog, m.fog);
      gl.uniform1f(pr.u.uFogAmt, o.fogBottom || 0); gl.uniform1f(pr.u.uAlpha, o.alpha === undefined ? 1 : o.alpha);
      gl.uniform1f(pr.u.uHaze, o.haze || 0);
      // rim padrão cresce com a proximidade da camada (parallax maior = mais perto)
      const rim = o.rim === undefined ? Math.min(0.9, par * 1.3) : o.rim;
      gl.uniform1f(pr.u.uRim, rim);
      gl.uniform1f(pr.u.uRimDir, m.sunPos[0] > 0.5 ? 1 : -1);
      gl.uniform3fv(pr.u.uRimCol, m.rayCol);
      applyBlend();
      full();
    }

    // esporos flutuantes (aditivo); q = 0..3 camadas conforme qualidade
    function drawMotes(m, layers) {
      if (layers <= 0) return;
      flush();
      const pr = P.motes; gl.useProgram(pr.p);
      const night = m.moon ? 1 : 0;
      const c = night ? [0.5, 0.75, 0.9] : m.rayCol;
      gl.uniform3fv(pr.u.uCol, c);
      gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uCam, camX); gl.uniform1f(pr.u.uAmt, 0.55);
      gl.uniform1i(pr.u.uLayers, Math.min(3, layers));
      const prev = curBlend; setBlend('add'); full(); setBlend(prev);
    }

    function drawMist(m, par, band, amt, scale) {
      flush();
      const pr = P.mist; gl.useProgram(pr.p);
      gl.uniform3fv(pr.u.uFog, m.mistCol || m.fog);
      gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uCam, camX); gl.uniform1f(pr.u.uAmt, amt);
      gl.uniform1f(pr.u.uBand, band); gl.uniform1f(pr.u.uPar, par); gl.uniform1f(pr.u.uScale, scale || 1);
      applyBlend();
      full();
    }

    function post(m, fx) {
      flush();
      gl.disable(gl.BLEND);
      // bright pass -> bloom[0]
      let pr = P.bright; gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom[0].fb); gl.viewport(0, 0, bloom[0].w, bloom[0].h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      gl.uniform1i(pr.u.uTex, 0); gl.uniform2f(pr.u.uTexel, 1 / scene.w, 1 / scene.h); gl.uniform1f(pr.u.uThr, m.bloomThr);
      full();
      // down chain
      pr = P.down; gl.useProgram(pr.p);
      for (let i = 1; i < bloom.length; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloom[i].fb); gl.viewport(0, 0, bloom[i].w, bloom[i].h);
        gl.bindTexture(gl.TEXTURE_2D, bloom[i - 1].tex);
        gl.uniform1i(pr.u.uTex, 0); gl.uniform2f(pr.u.uTexel, 1 / bloom[i - 1].w, 1 / bloom[i - 1].h);
        full();
      }
      // up chain (aditivo)
      pr = P.up; gl.useProgram(pr.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = bloom.length - 1; i > 0; i--) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloom[i - 1].fb); gl.viewport(0, 0, bloom[i - 1].w, bloom[i - 1].h);
        gl.bindTexture(gl.TEXTURE_2D, bloom[i].tex);
        gl.uniform1i(pr.u.uTex, 0); gl.uniform2f(pr.u.uTexel, 1 / bloom[i].w, 1 / bloom[i].h); gl.uniform1f(pr.u.uW, 0.75);
        full();
      }
      gl.disable(gl.BLEND);
      // composição
      pr = P.comp; gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, VW, VH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloom[0].tex);
      gl.uniform1i(pr.u.uScene, 0); gl.uniform1i(pr.u.uBloom, 1);
      const sunSx = m.sunPos[0] - camX * 0.025 / WW;
      gl.uniform2f(pr.u.uSunUV, sunSx, 1 - m.sunPos[1]);
      gl.uniform3fv(pr.u.uRayCol, m.rayCol);
      gl.uniform1f(pr.u.uBloomK, m.bloom); gl.uniform1f(pr.u.uRayK, m.rays * (fx.rayMul === undefined ? 1 : fx.rayMul));
      gl.uniform1f(pr.u.uExposure, m.exposure); gl.uniform1f(pr.u.uContrast, m.contrast); gl.uniform1f(pr.u.uSat, m.sat * (fx.satMul || 1));
      gl.uniform3fv(pr.u.uShadow, m.gradeShadow); gl.uniform3fv(pr.u.uHigh, m.gradeHigh);
      gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uAberr, 0.006 + (fx.aberr || 0));
      gl.uniform1f(pr.u.uFlash, fx.flash || 0); gl.uniform3fv(pr.u.uFlashCol, fx.flashCol || [1, 1, 1]);
      gl.uniform1f(pr.u.uFade, fx.fade === undefined ? 1 : fx.fade);
      gl.uniform1f(pr.u.uVig, m.vignette); gl.uniform1f(pr.u.uGrain, m.grain); gl.uniform1f(pr.u.uDepthBlur, m.depthBlur);
      full();
      applyBlend();
    }

    resize(1080);
    applyBlend();

    return {
      gl, hdr, canvas, WW, WH, resize, makeTex, texSet, freeSet,
      env, lights, setBlend, quad, sprite, flush, begin, drawSky, drawLayer, drawMotes, drawMist, post,
      get height() { return VH; }
    };
  };
})();
