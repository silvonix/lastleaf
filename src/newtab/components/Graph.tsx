import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Cluster } from "~lib/clustering"
import { ClusterCard } from "./ClusterCard"

const CARD_W = 162
const CARD_H = 86
const GAP_X = CARD_W + 90
const GAP_Y = CARD_H + 70

// Fixed-pixel grid layout — cards sit a consistent, comfortable distance
// apart regardless of how large the container is. A handful of clusters
// stay compact near the top-left instead of stretching to fill whatever
// viewport size happens to be available (which was forcing scrolling to
// find pills even when there was plenty of room to keep them close).
function getPositions(count: number): { x: number; y: number }[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const jitter = (seed: number) => (((seed * 137) % 17) / 17 - 0.5) * 16
  const positions: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    positions.push({
      x: col * GAP_X + jitter(i * 2),
      y: row * GAP_Y + jitter(i * 2 + 1)
    })
  }
  return positions
}

// Miscellaneous mixes unrelated sites by definition, so rather than let
// it land wherever its tab count happens to rank (usually top-left,
// since it's often the biggest single cluster), it always occupies the
// grid's geometric center slot — the other clusters keep their existing
// sort order and fill around it.
function centerMiscellaneous(clusters: Cluster[]): Cluster[] {
  const miscIndex = clusters.findIndex(c => c.category === "uncategorised")
  if (miscIndex === -1) return clusters

  const count = clusters.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  const centerSlot = Math.min(
    Math.floor((rows - 1) / 2) * cols + Math.floor((cols - 1) / 2),
    count - 1
  )

  const misc = clusters[miscIndex]
  const rest = clusters.filter((_, i) => i !== miscIndex)

  const ordered: Cluster[] = new Array(count)
  ordered[centerSlot] = misc
  let restIdx = 0
  for (let i = 0; i < count; i++) {
    if (i === centerSlot) continue
    ordered[i] = rest[restIdx++]
  }
  return ordered
}

// Categories that are typically related even with no shared keywords —
// used as a fallback signal so the graph isn't only as dense as literal
// keyword overlap allows. Deliberately conservative; not every pairing
// that could plausibly relate is listed, just the clearer ones.
const RELATED_CATEGORIES: Record<string, string[]> = {
  coding:   ["reading", "design", "docs"],
  reading:  ["coding", "news", "docs"],
  design:   ["coding", "shopping"],
  shopping: ["finance", "design", "travel"],
  finance:  ["shopping"],
  social:   ["video", "news"],
  video:    ["social"],
  travel:   ["shopping"],
  news:     ["reading", "social"],
  docs:     ["coding", "reading"],
}

function categoriesRelated(a: string, b: string): boolean {
  return (RELATED_CATEGORIES[a] ?? []).includes(b)
}

// An edge exists between two clusters when they share keywords (the
// strongest signal), or — failing that — when their categories are
// known to typically relate, as a fainter fallback so the graph isn't
// sparser than it needs to be just because titles didn't happen to
// share an exact word.
function getEdges(clusters: Cluster[]): { a: number; b: number; strength: number; viaCategory: boolean }[] {
  const edges: { a: number; b: number; strength: number; viaCategory: boolean }[] = []
  for (let i = 0; i < clusters.length; i++) {
    const kwA = new Set(clusters[i].keywords)
    for (let j = i + 1; j < clusters.length; j++) {
      const kwB = clusters[j].keywords
      let shared = 0
      for (const kw of kwB) if (kwA.has(kw)) shared++

      if (shared > 0) {
        edges.push({ a: i, b: j, strength: shared, viaCategory: false })
      } else if (categoriesRelated(clusters[i].category, clusters[j].category)) {
        edges.push({ a: i, b: j, strength: 0, viaCategory: true })
      }
    }
  }
  return edges
}

interface Props {
  clusters: Cluster[]
  selectedId: string | null
  onSelect: (id: string, scrollToTags: boolean) => void
}

export function Graph({ clusters, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1.15)

  // Miscellaneous always sits at the grid's center slot rather than
  // wherever its tab count would naturally rank it
  const orderedClusters = useMemo(() => centerMiscellaneous(clusters), [clusters])

  const rawPositions = useMemo(() => getPositions(orderedClusters.length), [orderedClusters.length])

  const gridW = useMemo(() => {
    if (!rawPositions.length) return 0
    return Math.max(...rawPositions.map(p => p.x)) + CARD_W
  }, [rawPositions])
  const gridH = useMemo(() => {
    if (!rawPositions.length) return 0
    return Math.max(...rawPositions.map(p => p.y)) + CARD_H
  }, [rawPositions])

  // When the grid is smaller than the visible board, center it instead
  // of pinning it to the top-left corner. Falls back to a flat margin
  // once there's no slack left to center within.
  const offsetX = useMemo(() => Math.max(24, (size.w - gridW) / 2), [size.w, gridW])
  const offsetY = useMemo(() => Math.max(24, (size.h - gridH) / 2), [size.h, gridH])

  const positions = useMemo(
    () => rawPositions.map(p => ({ x: p.x + offsetX, y: p.y + offsetY })),
    [rawPositions, offsetX, offsetY]
  )
  const edges = useMemo(() => getEdges(orderedClusters), [orderedClusters])

  // Content bounds so the container is exactly as big as it needs to be —
  // no bigger — so cards never end up scattered across empty space.
  // Trailing margin matches the leading offset for a symmetric, centered
  // look whenever there's slack to center within.
  const contentW = useMemo(() => {
    if (!positions.length) return 0
    return Math.max(...positions.map(p => p.x)) + CARD_W + offsetX
  }, [positions, offsetX])
  const contentH = useMemo(() => {
    if (!positions.length) return 0
    return Math.max(...positions.map(p => p.y)) + CARD_H + offsetY
  }, [positions, offsetY])

  const measure = useCallback(() => {
    if (!containerRef.current) return
    setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w || !size.h) return
    const dpr = window.devicePixelRatio || 1

    // Canvas covers the full zoomed content area
    const scaledW = Math.max(contentW, size.w) * zoom
    const scaledH = Math.max(contentH, size.h) * zoom
    canvas.width = scaledW * dpr
    canvas.height = scaledH * dpr
    canvas.style.width = scaledW + "px"
    canvas.style.height = scaledH + "px"

    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    edges.forEach(({ a, b, strength, viaCategory }) => {
      const ca = orderedClusters[a], cb = orderedClusters[b]
      if (!ca || !cb) return

      const posA = positions[a]
      const posB = positions[b]
      if (!posA || !posB) return

      const ax = (posA.x + CARD_W / 2) * zoom
      const ay = (posA.y + CARD_H / 2) * zoom
      const bx = (posB.x + CARD_W / 2) * zoom
      const by = (posB.y + CARD_H / 2) * zoom

      const isHighlighted = selectedId !== null && (ca.id === selectedId || cb.id === selectedId)

      // Bow the curve higher so it clears any card sitting between the
      // two real endpoints, instead of skimming close enough to look
      // like it terminates there
      const arcHeight = 52 * zoom
      const controlX = (ax + bx) / 2
      const controlY = (ay + by) / 2 - arcHeight

      // The card DOM elements paint on top of this canvas, so anything
      // drawn at a card's center (ax,ay / bx,by) is invisible — hidden
      // underneath the opaque card. Find where the line to the control
      // point actually crosses the card's border instead, and draw
      // (and mark) from there, in open canvas space.
      const halfW = (CARD_W / 2) * zoom
      const halfH = (CARD_H / 2) * zoom

      function edgePoint(cx: number, cy: number, dx: number, dy: number) {
        const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity
        const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity
        const t = Math.min(tx, ty, 1)
        return { x: cx + dx * t, y: cy + dy * t }
      }

      const startPt = edgePoint(ax, ay, controlX - ax, controlY - ay)
      const endPt = edgePoint(bx, by, controlX - bx, controlY - by)

      ctx.beginPath()
      ctx.moveTo(startPt.x, startPt.y)
      ctx.quadraticCurveTo(controlX, controlY, endPt.x, endPt.y)

      let strokeColor: string
      if (viaCategory) {
        // Category-relatedness is a weaker signal than an actual shared
        // keyword, so it stays visibly fainter/thinner than a real match
        // even when selected — but still needs enough weight to read
        // against the dot-grid background
        strokeColor = isHighlighted ? "rgba(186,117,23,0.45)" : "rgba(186,117,23,0.26)"
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = isHighlighted ? 1.4 : 1.1
        ctx.setLineDash([2, 4])
      } else {
        // More shared keywords = a more solid, more visible line
        const baseOpacity = Math.min(0.42 + strength * 0.12, 0.75)
        strokeColor = isHighlighted ? "rgba(186,117,23,0.75)" : `rgba(186,117,23,${baseOpacity})`
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = isHighlighted ? 2.2 : Math.min(1.8, 1.3 + strength * 0.3)
        ctx.setLineDash(isHighlighted ? [] : [4, 5])
      }

      ctx.stroke()
      ctx.setLineDash([])

      // Double-headed arrowhead at each end, pointing into the card it
      // touches — a much more standard "this line terminates here"
      // convention than a dot, and pointing into BOTH ends (rather than
      // just one) avoids implying a direction/causation this connection
      // doesn't actually have — keyword and category relatedness are
      // symmetric, not "A leads to B".
      const arrowSize = (isHighlighted ? 8 : 6.5) * zoom

      function drawArrowhead(tipX: number, tipY: number, dirX: number, dirY: number) {
        const len = Math.hypot(dirX, dirY) || 1
        const ux = dirX / len, uy = dirY / len
        const px = -uy, py = ux
        const backX = tipX - ux * arrowSize
        const backY = tipY - uy * arrowSize
        const halfW = arrowSize * 0.42

        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(backX + px * halfW, backY + py * halfW)
        ctx.lineTo(backX - px * halfW, backY - py * halfW)
        ctx.closePath()
        ctx.fillStyle = strokeColor
        ctx.fill()
      }

      drawArrowhead(startPt.x, startPt.y, ax - controlX, ay - controlY)
      drawArrowhead(endPt.x, endPt.y, bx - controlX, by - controlY)
    })
  }, [orderedClusters, edges, positions, selectedId, size, zoom, contentW, contentH])


  return (
    // Outer container — clips and allows scrolling when zoomed
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "auto", background: "#FDFCFB",
      backgroundImage: "radial-gradient(rgba(186,117,23,0.35) 1px, transparent 1px)",
      backgroundSize: "16px 16px"
    }}>

      {/* Inner wrapper — sized to fit the actual content, not the full viewport */}
      <div style={{ position: "relative", width: Math.max(contentW, size.w) * zoom, height: Math.max(contentH, size.h) * zoom, minWidth: "100%", minHeight: "100%" }}>

        {/* Canvas for edges — fills zoomed area */}
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />

        {/* Cards — positioned at fixed pixel coordinates */}
        {orderedClusters.map((cluster, i) => {
          const pos = positions[i]
          if (!pos) return null
          return (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              selected={cluster.id === selectedId}
              style={{
                left: pos.x * zoom,
                top: pos.y * zoom,
                transform: `scale(${zoom})`,
                transformOrigin: "top left"
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                const isMore = target.dataset.more === "true"
                onSelect(cluster.id, isMore)
              }}
            />
          )
        })}

      </div>

      {/* Legend — only shown when there's at least one real connection to explain */}
      {edges.length > 0 && (
        <div style={{
          position: "sticky", bottom: "16px", left: "16px",
          display: "inline-block", fontSize: "10.5px", color: "#9E9080",
          background: "rgba(255,255,255,0.85)", padding: "4px 9px", borderRadius: "6px",
          border: "0.5px solid #E8E5DE"
        }}>
          Lines connect clusters that share keywords or related topics
        </div>
      )}

      {/* Zoom controls — fixed to bottom right of viewport */}
      <div style={{ position: "sticky", bottom: "16px", float: "right", marginRight: "16px", display: "flex", flexDirection: "column", gap: "4px", zIndex: 10 }}>
        <button
          onClick={() => setZoom(z => Math.min(+(z + 0.15).toFixed(2), 2))}
          style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0.5px solid #E8E5DE", background: "#ffffff", color: "#854F0B", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >+</button>
        <button
          onClick={() => setZoom(z => Math.max(+(z - 0.15).toFixed(2), 0.4))}
          style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0.5px solid #E8E5DE", background: "#ffffff", color: "#854F0B", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >−</button>
        {zoom !== 1 && (
          <button
            onClick={() => setZoom(1)}
            style={{ width: "28px", height: "28px", borderRadius: "7px", border: "0.5px solid #E8E5DE", background: "#ffffff", color: "#BA7517", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontWeight: 500 }}
          >1:1</button>
        )}
      </div>

    </div>
  )
}