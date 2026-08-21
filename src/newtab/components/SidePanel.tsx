import { useMemo, useState } from "react"
import type { Cluster } from "~lib/clustering"
import type { TabRecord } from "~lib/storage"
import { TabRow } from "./TabRow"

interface Props {
  cluster: Cluster | null
  onClose: () => void
  onAction: () => void
  scrollToTags?: boolean
}

// Search only earns its place once a list is long enough to actually
// need it — below this, scrolling through everything is faster than
// typing.
const SEARCH_THRESHOLD = 6

function groupByDomain(tabs: TabRecord[]): { domain: string; tabs: TabRecord[] }[] {
  const groups = new Map<string, TabRecord[]>()
  for (const tab of tabs) {
    if (!groups.has(tab.domain)) groups.set(tab.domain, [])
    groups.get(tab.domain)!.push(tab)
  }
  return [...groups.entries()]
    .map(([domain, tabs]) => ({ domain, tabs }))
    .sort((a, b) => b.tabs.length - a.tabs.length)
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: open ? "8px" : "0" }}
      >
        <div style={{ fontSize: "10px", fontWeight: 600, color: "#BA7517", letterSpacing: "0.5px" }}>{title}</div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && children}
    </div>
  )
}

export function SidePanel({ cluster, onClose, onAction, scrollToTags }: Props) {
  const visible = !!cluster
  const [search, setSearch] = useState("")

  // Reset search whenever the selected cluster changes, so a filter
  // typed for one pill doesn't silently carry over into the next
  const clusterId = cluster?.id
  const [lastClusterId, setLastClusterId] = useState(clusterId)
  if (clusterId !== lastClusterId) {
    setLastClusterId(clusterId)
    if (search) setSearch("")
  }

  const filteredTabs = useMemo(() => {
    if (!cluster) return []
    const q = search.trim().toLowerCase()
    if (!q) return cluster.tabs
    return cluster.tabs.filter(t =>
      (t.title ?? "").toLowerCase().includes(q) || t.domain.toLowerCase().includes(q)
    )
  }, [cluster, search])

  const isMisc = cluster?.category === "uncategorised"
  const showSearch = (cluster?.tabs.length ?? 0) > SEARCH_THRESHOLD

  return (
    <div style={{
      width: visible ? "240px" : "0px",
      flexShrink: 0,
      overflow: "hidden",
      borderLeft: visible ? "0.5px solid #E8E5DE" : "none",
      background: "#FDFAF6",
      transition: "width 0.18s ease",
      display: "flex",
      flexDirection: "column"
    }}>
      {cluster && (
        <div style={{ minWidth: "240px", padding: "14px", flex: 1, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cluster.color.dot }} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#2C2C2A" }}>{cluster.label}</span>
            </div>
            <button onClick={onClose} aria-label="Close panel"
              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#B4B2A9", display: "flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Meta */}
          <div style={{ fontSize: "11px", color: "#888780", marginBottom: "16px", flexShrink: 0 }}>
            {cluster.tabs.length} tabs · {
              (() => {
                const ms = cluster.totalTime
                const h = Math.floor(ms / 3600000)
                const m = Math.floor((ms % 3600000) / 60000)
                return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : "<1m"
              })()
            } browsing
          </div>

          {/* TABS — capped at 70% of the panel height with its own
              internal scroll, so TOPICS always stays visible below it
              instead of requiring the whole panel to scroll */}
          <div style={{ flexShrink: 0, maxHeight: "70%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexShrink: 0 }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "#BA7517", letterSpacing: "0.5px" }}>TABS</div>
            </div>

            {showSearch && (
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search title or domain…"
                style={{
                  width: "100%", fontSize: "12px", padding: "6px 9px",
                  border: "0.5px solid #E8E5DE", borderRadius: "6px",
                  marginBottom: "10px", background: "#fff", color: "#2C2C2A",
                  outline: "none", flexShrink: 0
                }}
              />
            )}

            <div style={{ overflowY: "auto" }}>
              {filteredTabs.length === 0 && (
                <div style={{ fontSize: "11px", color: "#9E9080", padding: "8px 0" }}>
                  No tabs match "{search}"
                </div>
              )}

              {isMisc ? (
                // Miscellaneous mixes unrelated sites, so group by domain
                // instead of one long undifferentiated list
                groupByDomain(filteredTabs).map(group => (
                  <div key={group.domain} style={{ marginBottom: "10px" }}>
                    <div style={{
                      fontSize: "9.5px", fontWeight: 600, color: "#9E9080",
                      textTransform: "uppercase", letterSpacing: "0.4px",
                      marginBottom: "4px", display: "flex", justifyContent: "space-between"
                    }}>
                      <span>{group.domain}</span>
                      <span>{group.tabs.length}</span>
                    </div>
                    {group.tabs.map((tab, i) => (
                      <TabRow key={tab.id ?? i} tab={tab} defaultOpen={false} onAction={onAction} />
                    ))}
                  </div>
                ))
              ) : (
                <div>
                  {filteredTabs.map((tab, i) => (
                    <TabRow key={tab.id ?? i} tab={tab} defaultOpen={i === 0 && !search} onAction={onAction} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TOPICS below — always visible, not capped or scrolled */}
          <div style={{ marginTop: "16px", overflowY: "auto", flexShrink: 1 }}>
            <CollapsibleSection title="TOPICS" defaultOpen={true}>
              <div style={{ lineHeight: "2.2" }}>
                {cluster.keywords.map(kw => (
                  <span key={kw} style={{
                    fontSize: "11px", padding: "3px 8px", borderRadius: "20px",
                    display: "inline-block", margin: "2px 2px 2px 0",
                    background: cluster.color.bg, color: cluster.color.accent,
                    border: `0.5px solid ${cluster.color.bc}`
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          </div>

        </div>
      )}
    </div>
  )
}