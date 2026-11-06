"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export type OrbState = "resting" | "thinking" | "asleep" | "error"

type Rgb = readonly [number, number, number]

/** Deep, middle, and lit tones of the orb in each state. */
const PALETTES: Record<OrbState, { colors: [Rgb, Rgb, Rgb]; energy: number }> =
  {
    resting: {
      colors: [
        [0.015, 0.2, 0.22],
        [0.08, 0.66, 0.6],
        [0.8, 1, 0.93],
      ],
      energy: 0.12,
    },
    thinking: {
      colors: [
        [0.02, 0.26, 0.3],
        [0.12, 0.8, 0.76],
        [0.92, 1, 0.98],
      ],
      energy: 1,
    },
    asleep: {
      colors: [
        [0.035, 0.06, 0.07],
        [0.14, 0.21, 0.22],
        [0.36, 0.43, 0.43],
      ],
      energy: 0,
    },
    error: {
      colors: [
        [0.13, 0.05, 0.02],
        [0.55, 0.28, 0.1],
        [0.95, 0.7, 0.46],
      ],
      energy: 0.08,
    },
  }

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

/** A sphere of slow liquid light, with a soft halo and ripples while working. */
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uEnergy, uRadius;
uniform vec3 uDeep, uMid, uLight;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = turn * p * 2.02;
    amplitude *= 0.5;
  }
  return value;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float r = length(p) / uRadius;
  float inside = 1.0 - smoothstep(0.985, 1.005, r);
  float z = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
  vec2 q = (p / uRadius) * (1.15 - 0.3 * z);

  // Layers of warping at low frequency: this reads as silk, not as clouds.
  float t = uTime * (0.045 + 0.17 * uEnergy);
  vec2 w1 = vec2(fbm(q * 0.8 + vec2(t, 0.0)), fbm(q * 0.8 + vec2(5.2, -t)));
  vec2 w2 = vec2(
    fbm(q * 0.95 + 2.1 * w1 + vec2(1.7 + 0.4 * t, 9.2)),
    fbm(q * 0.95 + 2.1 * w1 + vec2(8.3, 2.8 - 0.3 * t))
  );
  float body = fbm(q * 0.7 + 2.3 * w2);
  float wave = fract(body * 2.4 + 0.7 * w2.x);
  float silk = pow(1.0 - abs(2.0 * wave - 1.0), 3.4);

  vec3 color = mix(uDeep, uMid, smoothstep(0.24, 0.72, body));
  color = mix(color, uLight, silk * smoothstep(0.24, 0.64, w2.y) * 0.92);
  color *= 0.78 + 0.42 * z;

  // A bright glassy rim, deepest at the very edge of the sphere.
  // Its colour drifts around the edge, like light through a soap film.
  float rim = pow(1.0 - z, 2.4);
  float film = 0.5 + 0.5 * sin(atan(p.y, p.x) + t * 2.0 + w2.x * 4.0);
  vec3 rimColor = mix(mix(uMid, uLight, 0.65), uLight * vec3(0.62, 0.78, 1.0), film * 0.75);
  color += rimColor * rim * 0.95;

  vec3 normal = normalize(vec3(p / uRadius, max(z, 0.001)));
  float highlight = max(dot(normal, normalize(vec3(-0.38, 0.56, 0.74))), 0.0);
  color += vec3(1.0) * (pow(highlight, 8.0) * 0.07 + pow(highlight, 160.0) * 0.3);

  float outside = max(r - 1.0, 0.0);
  float halo = exp(-outside * (2.9 - 1.1 * uEnergy)) * (0.2 + 0.26 * uEnergy);

  float ripples = 0.0;
  for (int i = 0; i < 3; i++) {
    float phase = fract(uTime * 0.2 + float(i) / 3.0);
    float ring = 1.0 + phase * 0.95;
    ripples += smoothstep(0.02, 0.0, abs(r - ring)) * (1.0 - phase) * 0.32;
  }
  ripples *= uEnergy;

  // Everything outside the sphere fades to nothing before the canvas ends.
  float fade = 1.0 - smoothstep(0.3, 0.5, length(p));
  float glow = (halo + ripples) * (1.0 - inside) * fade;
  gl_FragColor = vec4(color * inside + uMid * glow, inside + glow);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

/**
 * The agent's body: a living sphere of light. It's calm at rest, stirs and
 * ripples while working, and dims when off. It never renders during a measured
 * game, so nothing moves beside one. Without WebGL it falls back to CSS, and it
 * draws a single still frame for anyone who prefers reduced motion.
 */
export function AgentOrb({
  state,
  radius = 0.24,
  className,
}: {
  state: OrbState
  /** Sphere radius, as a fraction of the canvas. The rest is room for its halo. */
  radius?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const target = useRef(PALETTES[state])
  const redraw = useRef<(() => void) | null>(null)

  useEffect(() => {
    target.current = PALETTES[state]
    redraw.current?.()
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    })
    if (!canvas || !gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)
    canvas.dataset.gl = "1"

    // If the browser drops the GPU context, fall back to the CSS sphere.
    const onLost = () => delete canvas.dataset.gl
    canvas.addEventListener("webglcontextlost", onLost)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )
    const position = gl.getAttribLocation(program, "p")
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.clearColor(0, 0, 0, 0)

    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const uRes = uniform("uRes")
    const uTime = uniform("uTime")
    const uEnergy = uniform("uEnergy")
    const uDeep = uniform("uDeep")
    const uMid = uniform("uMid")
    const uLight = uniform("uLight")
    gl.uniform1f(uniform("uRadius"), radius)

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(canvas.clientWidth * scale)
      const height = Math.round(canvas.clientHeight * scale)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
        gl.uniform2f(uRes, width, height)
      }
    }
    const observer = new ResizeObserver(() => {
      resize()
      redraw.current?.()
    })
    observer.observe(canvas)
    resize()
    gl.uniform2f(uRes, canvas.width, canvas.height)

    const current = {
      colors: target.current.colors.map((rgb) => [...rgb]),
      energy: target.current.energy,
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    let time = 40
    let last = performance.now()
    let frame = 0

    const draw = (ease: number) => {
      // Moving towards the target, so changes of state feel like breathing.
      current.energy += (target.current.energy - current.energy) * ease
      current.colors.forEach((rgb, tone) =>
        rgb.forEach((value, channel) => {
          rgb[channel] =
            value + (target.current.colors[tone]![channel]! - value) * ease
        })
      )
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(uTime, time)
      gl.uniform1f(uEnergy, current.energy)
      gl.uniform3fv(uDeep, current.colors[0]!)
      gl.uniform3fv(uMid, current.colors[1]!)
      gl.uniform3fv(uLight, current.colors[2]!)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (reduced) {
      redraw.current = () => draw(1)
      draw(1)
    } else {
      const loop = (now: number) => {
        const delta = Math.min((now - last) / 1000, 0.1)
        last = now
        time += delta
        draw(1 - Math.exp(-delta * 2.2))
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      redraw.current = null
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteBuffer(buffer)
      canvas.removeEventListener("webglcontextlost", onLost)
      // The context stays alive: this canvas may be reused by the next mount,
      // and the browser frees it along with the element.
    }
  }, [radius])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("orb-canvas pointer-events-none size-full", className)}
    />
  )
}
