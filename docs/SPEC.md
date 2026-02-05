# TvX - IPTV Client Specification

## Overview

TvX is a minimal IPTV client that connects to Xtream Codes compatible servers. It provides access to Live TV, Movies, and Series with a clean, distraction-free interface.

---

## Core Features

### Content Types
- **Live TV** - Real-time streaming channels organized by category
- **Movies** - Video-on-demand films
- **Series** - TV shows with seasons and episodes

### Navigation & Organization
- **Categories/Folders** - Hierarchical organization of content
- **Favorites** - User-curated list across all content types
- **Search** - Global search across Live, Movies, and Series
- **Recently Watched** - Quick access to recent content

---

## Xtream Codes API Integration

### Authentication
```
GET /player_api.php?username={user}&password={pass}
```

Returns server info, user status, and allowed output formats.

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `get_live_categories` | List all Live TV categories |
| `get_live_streams` | List channels (optionally by category) |
| `get_vod_categories` | List all Movie categories |
| `get_vod_streams` | List movies (optionally by category) |
| `get_series_categories` | List all Series categories |
| `get_series` | List series (optionally by category) |
| `get_series_info` | Get seasons/episodes for a series |

### Stream URLs
- **Live**: `http://{server}:{port}/{user}/{pass}/{stream_id}.{ext}`
- **VOD**: `http://{server}:{port}/movie/{user}/{pass}/{stream_id}.{ext}`
- **Series**: `http://{server}:{port}/series/{user}/{pass}/{episode_id}.{ext}`

---

## User Interface

### Design Principles
- Minimal chrome, maximum content
- Dark theme optimized for viewing
- Keyboard and remote-friendly navigation
- Fast, responsive interactions

### Screens

#### 1. Login
- Server URL input
- Username / Password fields
- Remember credentials option
- Connection status indicator

#### 2. Home
- Three main sections: Live | Movies | Series
- Quick access to Favorites and Recently Watched
- Global search bar

#### 3. Category Browser
- Grid or list view of categories
- Breadcrumb navigation for nested folders
- Item count per category

##### Group Visibility Controls
- **Hide All Button** - Collapse/hide all items within a category/group
- **Show One at a Time Mode** - Toggle to enable exclusive group view (expanding one group automatically collapses others)
- **Group visibility state persisted** - Remember which groups are expanded/collapsed

##### URL Actions
- **Copy Stream URL** - Copy the direct downloadable stream URL to clipboard
  - Available in content grid context menu
  - Available in detail view
  - Shows confirmation toast on copy

#### 4. Content Grid
- Thumbnail grid with title overlay
- Lazy loading for large lists
- Sort options (A-Z, Recently Added)
- Filter by favorites

#### 5. Detail View (Movies/Series)
- Poster and backdrop
- Title, year, duration, rating
- Plot description
- Play button / Add to Favorites
- For Series: Season selector, episode list

#### 6. Player
- Fullscreen video playback
- Minimal overlay controls (play/pause, seek, volume)
- Channel info banner (Live TV)
- EPG info when available (Live TV)
- Quick channel switch (Live TV)

#### 7. Search Results
- Unified results across all content types
- Tabbed filtering: All | Live | Movies | Series
- Keyboard-driven selection

#### 8. Favorites
- Combined list of favorited items
- Grouped by type or unified list
- Quick remove option

#### 9. Settings
- **Group Behavior Section**
  - Toggle: "Show one group at a time" (accordion mode)
  - Button: "Expand all groups"
  - Button: "Collapse all groups"
- **Clipboard Section**
  - Toggle: "Show confirmation when URL copied"
  - URL format preference (with/without credentials visible)

---

## Data Models

### Server Connection
```
{
  id: string
  name: string
  url: string
  username: string
  password: string
  lastConnected: timestamp
}
```

### Channel (Live)
```
{
  id: number
  name: string
  icon: string
  categoryId: number
  epgChannelId: string
  isFavorite: boolean
}
```

### Movie (VOD)
```
{
  id: number
  name: string
  poster: string
  backdrop: string
  year: string
  duration: string
  rating: string
  plot: string
  categoryId: number
  isFavorite: boolean
}
```

### Series
```
{
  id: number
  name: string
  poster: string
  backdrop: string
  year: string
  rating: string
  plot: string
  categoryId: number
  seasons: Season[]
  isFavorite: boolean
}
```

### Episode
```
{
  id: number
  seasonNumber: number
  episodeNumber: number
  title: string
  plot: string
  duration: string
}
```

### Category
```
{
  id: number
  name: string
  parentId: number | null
  type: 'live' | 'movie' | 'series'
}
```

---

## Local Storage

### Persisted Data
- Server connections (encrypted credentials)
- Favorites list (per server)
- Watch history / progress
- User preferences (theme, default view)
- Group visibility states (expanded/collapsed per category)
- Show One at a Time preference (boolean)

### Caching
- Category lists (refresh on demand)
- Content metadata (TTL: 24 hours)
- Thumbnails (disk cache)

---

## Keyboard / Remote Navigation

| Key | Action |
|-----|--------|
| Arrow keys | Navigate grid/list |
| Enter | Select / Play |
| Backspace | Go back |
| F | Toggle favorite |
| S | Open search |
| Escape | Exit fullscreen / Close modal |
| Space | Play / Pause |
| Left/Right (in player) | Seek |
| Up/Down (in player, Live) | Change channel |
| H | Hide/collapse current group |
| Ctrl+H | Hide all groups |
| C | Copy stream URL (when item focused) |

---

## Technical Considerations

### Performance
- Virtual scrolling for large lists
- Progressive image loading
- Background data prefetching

### Error Handling
- Connection timeout handling
- Stream failure recovery
- Offline mode for cached content

### Security
- Encrypted credential storage
- HTTPS enforcement where supported

---

## Future Considerations (Out of Scope for v1)
- EPG (Electronic Program Guide) with grid view
- Multi-server support
- Parental controls
- Recording/DVR (if server supports)
- Chromecast / external player support
- Picture-in-picture mode

---

## Tech Stack (Suggested)

| Component | Technology |
|-----------|------------|
| Framework | Electron or Tauri |
| UI | React + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand or Redux Toolkit |
| Video | Video.js or native HTML5 |
| Storage | SQLite or IndexedDB |

---

## MVP Scope

1. Single server login
2. Browse Live, Movies, Series by category
3. Play content
4. Add/remove favorites
5. Basic search
6. Persistent favorites and credentials
7. Group visibility controls (hide all, show one at a time)
8. Copy stream URL to clipboard
