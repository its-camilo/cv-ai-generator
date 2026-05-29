import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

type GrainientCtx = {
  renderer: Renderer;
  program: Program;
  mesh: Mesh;
};

const ctxMap = new WeakMap<HTMLElement, GrainientCtx>();

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
 float t=iTime*uTimeSpeed;
 vec2 uv=C/iResolution.xy;
 float ratio=iResolution.x/iResolution.y;
 vec2 tuv=uv-0.5+uCenterOffset;
 tuv/=max(uZoom,0.001);
 float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
 tuv.y*=1.0/ratio;
 tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
 tuv.y*=ratio;
 float frequency=uWarpFrequency;
 float ws=max(uWarpStrength,0.001);
 float amplitude=uWarpAmplitude/ws;
 float warpTime=t*uWarpSpeed;
 tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
 tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);
 vec3 colLav=uColor1;
 vec3 colOrg=uColor2;
 vec3 colDark=uColor3;
 float b=uColorBalance;
 float s=max(uBlendSoftness,0.0);
 mat2 blendRot=Rot(radians(uBlendAngle));
 float blendX=(tuv*blendRot).x;
 float edge0=-0.3-b-s;
 float edge1=0.2-b+s;
 float v0=0.5-b+s;
 float v1=-0.3-b-s;
 vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
 vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
 vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));
 vec2 grainUv=uv*max(uGrainScale,0.001);
 if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
 float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
 col+=(grain-0.5)*uGrainAmount;
 col=(col-0.5)*uContrast+0.5;
 float luma=dot(col,vec3(0.2126,0.7152,0.0722));
 col=mix(vec3(luma),col,uSaturation);
 col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
 col=clamp(col,0.0,1.0);
 o=vec4(col,1.0);
}
void main(){
 vec4 o=vec4(0.0);
 mainImage(o,gl_FragCoord.xy);
 fragColor=o;
}
`;

@Component({
  selector: 'app-grainient',
  template: `<div class="grainient-container" #container></div>`,
  styleUrl: './grainient.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Grainient implements OnDestroy {
  readonly color1 = input('#c4a574');
  readonly color2 = input('#5c2430');
  readonly color3 = input('#0c0b0a');
  readonly timeSpeed = input(0.18);
  readonly grainAmount = input(0.14);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private cleanup: (() => void) | null = null;

  constructor() {
    afterNextRender(() => {
      this.initWebGl();
    });
  }

  ngOnDestroy(): void {
    this.cleanup?.();
  }

  private initWebGl(): void {
    const container = this.container().nativeElement;
    if (!container) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });

    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uTimeSpeed: { value: this.timeSpeed() },
        uColorBalance: { value: -0.08 },
        uWarpStrength: { value: 1.0 },
        uWarpFrequency: { value: 4.5 },
        uWarpSpeed: { value: 1.6 },
        uWarpAmplitude: { value: 55.0 },
        uBlendAngle: { value: 12.0 },
        uBlendSoftness: { value: 0.08 },
        uRotationAmount: { value: 420.0 },
        uNoiseScale: { value: 1.8 },
        uGrainAmount: { value: this.grainAmount() },
        uGrainScale: { value: 2.2 },
        uGrainAnimated: { value: 1.0 },
        uContrast: { value: 1.35 },
        uGamma: { value: 1.05 },
        uSaturation: { value: 0.92 },
        uCenterOffset: { value: new Float32Array([0.05, -0.08]) },
        uZoom: { value: 0.85 },
        uColor1: { value: new Float32Array(hexToRgb(this.color1())) },
        uColor2: { value: new Float32Array(hexToRgb(this.color2())) },
        uColor3: { value: new Float32Array(hexToRgb(this.color3())) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctxMap.set(container, { renderer, program, mesh });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const res = (program.uniforms['iResolution'] as { value: Float32Array }).value;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const t0 = performance.now();

    const loop = (t: number) => {
      (program.uniforms['iTime'] as { value: number }).value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0) raf = requestAnimationFrame(loop);
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        isVisible ? tryStart() : tryStop();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      isPageVisible ? tryStart() : tryStop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    tryStart();

    this.cleanup = () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      ctxMap.delete(container);
      try {
        container.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };
  }
}
