import { useEffect, useState } from "react"
import { getStorageStats, formatStorageSize } from "~lib/storage"

const LeafLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <g transform="translate(50,52) rotate(25)">
      <path d="M0 -44 Q38 -28 28 8 Q0 24 -28 8 Q-38 -18 0 -44 Z" fill="#BA7517"/>
      <path d="M0 -38 Q-1 -14 -2 10" fill="none" stroke="#FAC775" strokeWidth="4" strokeLinecap="round"/>
      <path d="M-1 -22 Q-14 -12 -20 -2" fill="none" stroke="#FAC775" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M-1 -8 Q12 -2 16 6" fill="none" stroke="#FAC775" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M-2 12 Q-4 22 -6 30" fill="none" stroke="#BA7517" strokeWidth="3.5" strokeLinecap="round"/>
    </g>
    <g transform="translate(50,52) rotate(25)" opacity="0.22">
      <path d="M12 -48 Q50 -32 40 4 Q12 20 -16 4 Q-26 -22 12 -48 Z" fill="#EF9F27"/>
    </g>
  </svg>
)

function MenuItem({ icon, label, sub, onClick }: { icon: string; label: string; sub?: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 16px", cursor: "pointer", background: hovered ? "#F9F8F5" : "transparent", transition: "background 0.1s" }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: "16px", color: "#BA7517", flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#2C2C2A" }}>{label}</div>
        {sub && <div style={{ fontSize: "11px", color: "#888780", marginTop: "1px" }}>{sub}</div>}
      </div>
      <i className="ti ti-chevron-right" style={{ fontSize: "13px", color: "#D3D1C7", flexShrink: 0 }} aria-hidden="true" />
    </div>
  )
}

export default function Popup() {
  const [stats, setStats] = useState<{ tabCount: number; estimatedMB: number } | null>(null)

  useEffect(() => {
    // Read cached stats instantly from chrome.storage.local (no IndexedDB cold start)
    chrome.storage.local.get("lastleaf_stats_cache", (result) => {
      if (result.lastleaf_stats_cache) {
        setStats(result.lastleaf_stats_cache)
      }
    })
    // Then update with fresh count in background
    getStorageStats().then(fresh => {
      setStats(fresh)
      chrome.storage.local.set({ lastleaf_stats_cache: fresh })
    })
  }, [])

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/newtab/index.html") })
    window.close()
  }

  function openSettings() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") })
    window.close()
  }

  function openFeedback() {
    chrome.tabs.create({ url: "mailto:hello@umbrova.com" })
    window.close()
  }

  function openSite() {
    chrome.tabs.create({ url: "https://lastleaf.umbrova.com" })
    window.close()
  }

  return (
    <div style={{ width: "240px", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: "#ffffff", overflow: "hidden" }}>

      {/* Header — minimal white */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid #F0EDE6", display: "flex", alignItems: "center", gap: "8px" }}>
        <LeafLogo size={32} />
        <span style={{ fontSize: "19px", fontWeight: 400, color: "#2C2C2A", fontFamily: "Georgia, serif", fontStyle: "italic" }}>lastleaf</span>
      </div>

      {/* Stats — subtle amber tint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "12px 16px", borderBottom: "0.5px solid #F0EDE6", background: "#FDFCFB" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#2C2C2A" }}>{stats?.tabCount ?? "—"}</div>
          <div style={{ fontSize: "10px", color: "#BA7517", letterSpacing: "0.3px", marginTop: "1px" }}>TABS BURIED</div>
        </div>
        <div style={{ width: "0.5px", height: "28px", background: "#E8E5DE" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#2C2C2A" }}>{stats ? formatStorageSize(stats.estimatedMB) : "—"}</div>
          <div style={{ fontSize: "10px", color: "#BA7517", letterSpacing: "0.3px", marginTop: "1px" }}>STORAGE</div>
        </div>
      </div>

      {/* Menu */}
      <div style={{ paddingTop: "4px", paddingBottom: "4px" }}>
        <MenuItem icon="ti-layout-grid" label="Dashboard" sub="View your tab graveyard" onClick={openDashboard} />
        <div style={{ height: "0.5px", background: "#F0EDE6", margin: "0 16px" }} />
        <MenuItem icon="ti-settings" label="Settings" sub="Capture, data & preferences" onClick={openSettings} />
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 16px", borderTop: "0.5px solid #F0EDE6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", color: "#B4B2A9" }}>© 2026 Umbrova</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={openFeedback}
            aria-label="Email hello@umbrova.com"
            title="hello@umbrova.com"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#B4B2A9", display: "flex", alignItems: "center" }}
          >
            <i className="ti ti-mail" style={{ fontSize: "13px" }} aria-hidden="true" />
          </button>
          <button
            onClick={openSite}
            aria-label="lastleaf.umbrova.com"
            title="lastleaf.umbrova.com"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#B4B2A9", display: "flex", alignItems: "center" }}
          >
            <i className="ti ti-world" style={{ fontSize: "13px" }} aria-hidden="true" />
          </button>
        </div>
      </div>

    </div>
  )
}