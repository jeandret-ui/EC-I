/* =====================================================================
   GL3D — dependency-free WebGL renderer for the terrain diorama
   ===================================================================== */
const GL3D = (() => {
  /* ---------- mat4 (column-major) ---------- */
  const M = {
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    lookAt(e, c, u) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map(v => v / l);
      let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map(v => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
    },
    inv(m) {
      const o = new Float32Array(16), [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
      return o;
    },
    xf(m, p) { const x = p[0], y = p[1], z = p[2], w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w]; },
  };

  const VS_T = `attribute vec3 aPos; attribute vec2 aUv; attribute vec2 aGrad;
uniform mat4 uMVP; uniform float uExag; uniform vec3 uEye;
varying vec2 vUv; varying vec3 vN; varying float vD;
void main(){ vec3 p=vec3(aPos.xy,aPos.z*uExag); vUv=aUv; vN=normalize(vec3(-aGrad.x*uExag,-aGrad.y*uExag,1.0)); vD=length(p-uEye); gl_Position=uMVP*vec4(p,1.0); }`;
  const FS_T = `precision mediump float; uniform sampler2D uTex; uniform vec3 uLight; uniform vec3 uFog; uniform float uFogD; uniform float uAmb;
varying vec2 vUv; varying vec3 vN; varying float vD;
void main(){ vec3 c=texture2D(uTex,vUv).rgb; float d=max(dot(normalize(vN),uLight),0.0); vec3 col=c*(uAmb+(1.0-uAmb)*d);
 float f=1.0-exp(-pow(vD*uFogD,2.0)); gl_FragColor=vec4(mix(col,uFog,clamp(f,0.0,0.85)),1.0); }`;
  const VS_M = `attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol; uniform mat4 uMVP; uniform vec3 uEye;
varying vec3 vN; varying vec4 vC; varying float vD;
void main(){ vN=aNor; vC=aCol; vD=length(aPos-uEye); gl_Position=uMVP*vec4(aPos,1.0); }`;
  const FS_M = `precision mediump float; uniform vec3 uLight; uniform vec3 uFog; uniform float uFogD; uniform float uEmis;
varying vec3 vN; varying vec4 vC; varying float vD;
void main(){ float d=abs(dot(normalize(vN),uLight)); vec3 col=vC.rgb*mix(0.45+0.55*d,1.0,uEmis);
 float f=1.0-exp(-pow(vD*uFogD,2.0)); gl_FragColor=vec4(mix(col,uFog,clamp(f,0.0,0.85)),vC.a); }`;
  const VS_P = `attribute vec3 aPos; attribute vec4 aCol; attribute float aSize; uniform mat4 uMVP; uniform float uPx; varying vec4 vC;
void main(){ vC=aCol; gl_Position=uMVP*vec4(aPos,1.0); gl_PointSize=max(2.0,aSize*uPx/gl_Position.w); }`;
  const FS_P = `precision mediump float; varying vec4 vC; void main(){ vec2 q=gl_PointCoord*2.0-1.0; float r=dot(q,q); if(r>1.0) discard; float a=exp(-r*2.6); gl_FragColor=vec4(vC.rgb*a*vC.a,a*vC.a); }`;

  function create(canvas) {
    const opt = { antialias: true, premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', opt), isGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt);
    if (!gl) return null;
    const u32 = isGL2 || !!gl.getExtension('OES_element_index_uint');
    const prog = (vs, fs) => {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const loc = {}; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc[a.name] = gl.getAttribLocation(p, a.name); }
      const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
      return { p, loc };
    };
    const PT = prog(VS_T, FS_T), PM = prog(VS_M, FS_M), PP = prog(VS_P, FS_P);
    const buf = (data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
    const R = {
      gl, terrain: null, opaque: null, trans: null, points: null, tex: null, exag: 3,
      cam: { tx: 0, ty: 0, tz: 0.2, dist: 30, az: -0.35, el: 0.62, fov: 38 * Math.PI / 180 },
      fog: [0.9, 0.92, 0.93], fogD: 0.012, light: norm([-0.45, 0.55, 0.7]), amb: 0.5, vp: null, w: 1, h: 1,
    };
    function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
    R.setTerrain = (geo) => {
      const t = R.terrain; if (t) { [t.pb, t.ub, t.gb, t.ib].forEach(b => gl.deleteBuffer(b)); }
      R.terrain = { pb: buf(geo.pos), ub: buf(geo.uv), gb: buf(geo.grad), ib: buf(geo.idx, gl.ELEMENT_ARRAY_BUFFER), n: geo.idx.length, type: geo.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    };
    R.setTexture = (cv) => {
      if (!R.tex) R.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, R.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    const meshObj = (m) => {
      if (!m || !m.idx.length) return null;
      const idx = m.idx.length && m.pos.length / 3 > 65535 && u32 ? new Uint32Array(m.idx) : new Uint16Array(m.idx);
      return { pb: buf(new Float32Array(m.pos)), nb: buf(new Float32Array(m.nor)), cb: buf(new Float32Array(m.col)), ib: buf(idx, gl.ELEMENT_ARRAY_BUFFER), n: idx.length, type: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    };
    const freeMesh = o => { if (o) [o.pb, o.nb, o.cb, o.ib].forEach(b => gl.deleteBuffer(b)); };
    R.setMeshes = (opaque, trans, glow) => { freeMesh(R.opaque); freeMesh(R.trans); freeMesh(R.glow); R.opaque = meshObj(opaque); R.trans = meshObj(trans); R.glow = meshObj(glow); };
    R.setPoints = (pos, col, size) => {
      if (!R.points || R.points.cap < pos.length) {
        if (R.points) [R.points.pb, R.points.cb, R.points.sb].forEach(b => gl.deleteBuffer(b));
        const cap = Math.max(pos.length, 3000);
        R.points = { pb: buf(new Float32Array(cap), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), cb: buf(new Float32Array(cap / 3 * 4), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), sb: buf(new Float32Array(cap / 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), cap };
      }
      const P = R.points; P.n = pos.length / 3;
      gl.bindBuffer(gl.ARRAY_BUFFER, P.pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.cb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, col);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.sb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, size);
    };
    const attr = (loc, b, n) => { if (loc == null || loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
    const off = (...locs) => locs.forEach(l => l != null && l >= 0 && gl.disableVertexAttribArray(l));
    R.eye = () => { const c = R.cam; return [c.tx + c.dist * Math.cos(c.el) * Math.sin(c.az), c.ty - c.dist * Math.cos(c.el) * Math.cos(c.az), c.tz + c.dist * Math.sin(c.el)]; };
    R.matrices = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      R.w = w; R.h = h; R.dpr = dpr;
      const eye = R.eye(), c = R.cam;
      const P = M.persp(c.fov, Math.max(0.1, w / Math.max(1, h)), Math.max(0.02, c.dist * 0.01), c.dist * 8 + 80);
      const V = M.lookAt(eye, [c.tx, c.ty, c.tz], [0, 0, 1]);
      R.vp = M.mul(P, V); R.ivp = M.inv(R.vp); R.eyePos = eye; return R.vp;
    };
    R.render = () => {
      const vp = R.matrices(), eye = R.eyePos;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.CULL_FACE);
      if (R.terrain && R.tex) {
        const L = PT.loc; gl.useProgram(PT.p);
        gl.uniformMatrix4fv(L.uMVP, false, vp); gl.uniform1f(L.uExag, R.exag); gl.uniform3fv(L.uEye, eye); gl.uniform3fv(L.uLight, R.light);
        gl.uniform3fv(L.uFog, R.fog); gl.uniform1f(L.uFogD, R.fogD); gl.uniform1f(L.uAmb, R.amb);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.tex); gl.uniform1i(L.uTex, 0);
        attr(L.aPos, R.terrain.pb, 3); attr(L.aUv, R.terrain.ub, 2); attr(L.aGrad, R.terrain.gb, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.terrain.ib); gl.drawElements(gl.TRIANGLES, R.terrain.n, R.terrain.type, 0);
        off(L.aPos, L.aUv, L.aGrad);
      }
      const drawMesh = (o, emis) => {
        if (!o) return; const L = PM.loc; gl.useProgram(PM.p);
        gl.uniformMatrix4fv(L.uMVP, false, vp); gl.uniform3fv(L.uEye, eye); gl.uniform3fv(L.uLight, R.light); gl.uniform3fv(L.uFog, R.fog); gl.uniform1f(L.uFogD, R.fogD); gl.uniform1f(L.uEmis, emis);
        attr(L.aPos, o.pb, 3); attr(L.aNor, o.nb, 3); attr(L.aCol, o.cb, 4);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ib); gl.drawElements(gl.TRIANGLES, o.n, o.type, 0); off(L.aPos, L.aNor, L.aCol);
      };
      drawMesh(R.opaque, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      drawMesh(R.trans, 0.35);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); drawMesh(R.glow, 1);
      if (R.points && R.points.n) {
        const L = PP.loc; gl.useProgram(PP.p); gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniformMatrix4fv(L.uMVP, false, vp); gl.uniform1f(L.uPx, canvas.height * 0.9);
        attr(L.aPos, R.points.pb, 3); attr(L.aCol, R.points.cb, 4); attr(L.aSize, R.points.sb, 1);
        gl.drawArrays(gl.POINTS, 0, R.points.n); off(L.aPos, L.aCol, L.aSize);
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
    };
    R.project = (p) => { const v = M.xf(R.vp, p); if (v[3] <= 0 || v[2] > 1) return null; return [(v[0] * .5 + .5) * R.w, (1 - (v[1] * .5 + .5)) * R.h, v[2]]; };
    R.ray = (sx, sy) => { const nx = sx / R.w * 2 - 1, ny = 1 - sy / R.h * 2; const a = M.xf(R.ivp, [nx, ny, -1]), b = M.xf(R.ivp, [nx, ny, 1]); const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return { o: a.slice(0, 3), d: d.map(v => v / l) }; };
    /* orbit controls */
    let drag = null; const pointers = new Map();
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey || e.ctrlKey, moved: 0 }; R.onInteract && R.onInteract(); });
    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) { R.onHover && R.onHover(e); return; }
      const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const ps = [...pointers.values()], other = [...pointers.entries()].find(([k]) => k !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); if (d0 > 0) R.zoom(d0 / d1); R.dirty = true; return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      const c = R.cam;
      if (drag.pan) { // right = (cos az, sin az), forward = (−sin az, cos az)
        const s = c.dist / R.h * 1.1, ca = Math.cos(c.az), sa = Math.sin(c.az);
        c.tx += (-dx * ca - dy * sa) * s; c.ty += (-dx * sa + dy * ca) * s;
        c.tx = clampT(c.tx, R.bounds?.x); c.ty = clampT(c.ty, R.bounds?.y); }
      else { c.az -= dx * 0.006; c.el = Math.max(0.05, Math.min(1.53, c.el + dy * 0.005)); }
      R.dirty = true;
    });
    const up = e => { pointers.delete(e.pointerId); if (drag && drag.moved < 4 && R.onClick) R.onClick(e); drag = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); R.zoom(Math.exp(e.deltaY * 0.0012)); R.dirty = true; R.onInteract && R.onInteract(); }, { passive: false });
    const clampT = (v, r) => r ? Math.max(r[0], Math.min(r[1], v)) : v;
    R.zoom = f => { R.cam.dist = Math.max(0.8, Math.min(90, R.cam.dist * f)); };
    return R;
  }

  /* ---------- geometry builders (accumulate into a mesh) ---------- */
  function Mesh() { return { pos: [], nor: [], col: [], idx: [] }; }
  function cylinder(m, a, b, r, seg, col, r2) {
    const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...ax), t = ax.map(v => v / L);
    let s = Math.abs(t[2]) < 0.9 ? cross(t, [0, 0, 1]) : cross(t, [1, 0, 0]); s = nrm(s); const u = cross(s, t);
    const base = m.pos.length / 3; r2 = r2 ?? r;
    for (let i = 0; i <= seg; i++) { const th = i / seg * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th), n = [s[0] * c + u[0] * sn, s[1] * c + u[1] * sn, s[2] * c + u[2] * sn];
      for (const [p, rr] of [[a, r], [b, r2]]) { m.pos.push(p[0] + n[0] * rr, p[1] + n[1] * rr, p[2] + n[2] * rr); m.nor.push(...n); m.col.push(...col); } }
    for (let i = 0; i < seg; i++) { const k = base + i * 2; m.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  function sphere(m, c, r, col, seg = 10) {
    const base = m.pos.length / 3;
    for (let i = 0; i <= seg; i++) { const ph = i / seg * Math.PI; for (let j = 0; j <= seg; j++) { const th = j / seg * 2 * Math.PI;
      const n = [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)]; m.pos.push(c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r); m.nor.push(...n); m.col.push(...col); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, b = a + seg + 1; m.idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  /* tube along points with elliptical cross-section (rh horizontal, rv vertical) and per-ring colors */
  function tube(m, pts, rh, rv, cols, seg = 20) {
    const n = pts.length, base = m.pos.length / 3;
    const t = nrm([pts[n - 1][0] - pts[0][0], pts[n - 1][1] - pts[0][1], pts[n - 1][2] - pts[0][2]]);
    const s = nrm(cross(t, [0, 0, 1])), u = cross(s, t);
    for (let i = 0; i < n; i++) for (let j = 0; j <= seg; j++) {
      const th = j / seg * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th), a = rh[i], b = rv[i];
      m.pos.push(pts[i][0] + s[0] * a * c + u[0] * b * sn, pts[i][1] + s[1] * a * c + u[1] * b * sn, pts[i][2] + s[2] * a * c + u[2] * b * sn);
      m.nor.push(...nrm([s[0] * c + u[0] * sn, s[1] * c + u[1] * sn, s[2] * c + u[2] * sn])); m.col.push(...cols[i]);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, b = a + seg + 1; m.idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  /* antenna radiation lobe. gainFn(azDeg, elDeg) → dB relative to max (≤0), in true (unexaggerated) directions.
     Sampling is dense around the boresight (az, el); 'up' mode samples around zenith for omnis. Vertical offsets × exag. */
  function lobe(m, o, az, el, gainFn, L, col, exag = 1, up = false, floor = 30, nTh = 30, nPh = 40) {
    const base = m.pos.length / 3, A = az * Math.PI / 180, E = el * Math.PI / 180;
    const f = up ? [0, 0, 1] : [Math.sin(A) * Math.cos(E), Math.cos(A) * Math.cos(E), Math.sin(E)];
    const r0 = up ? [1, 0, 0] : nrm(cross(f, [0, 0, 1])), u0 = cross(r0, f);
    for (let i = 0; i <= nTh; i++) { const th = Math.PI * (up ? i / nTh : Math.pow(i / nTh, 1.7));
      for (let j = 0; j <= nPh; j++) { const ph = j / nPh * 2 * Math.PI, st = Math.sin(th), ct = Math.cos(th);
        const d = [f[0] * ct + (r0[0] * Math.cos(ph) + u0[0] * Math.sin(ph)) * st, f[1] * ct + (r0[1] * Math.cos(ph) + u0[1] * Math.sin(ph)) * st, f[2] * ct + (r0[2] * Math.cos(ph) + u0[2] * Math.sin(ph)) * st];
        const azD = Math.atan2(d[0], d[1]) * 180 / Math.PI, elD = Math.asin(Math.max(-1, Math.min(1, d[2]))) * 180 / Math.PI;
        const g = Math.max(-floor, Math.min(0, gainFn(azD, elD))), k = (g + floor) / floor, r = L * k;
        m.pos.push(o[0] + d[0] * r, o[1] + d[1] * r, o[2] + d[2] * r * exag); m.nor.push(...nrm([d[0], d[1], d[2] / Math.max(exag, 1e-3)]));
        m.col.push(col[0], col[1], col[2], col[3] * (0.25 + 0.75 * k)); } }
    for (let i = 0; i < nTh; i++) for (let j = 0; j < nPh; j++) { const a = base + i * (nPh + 1) + j, b = a + nPh + 1; m.idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  return { create, M, Mesh, cylinder, sphere, tube, lobe };
})();
