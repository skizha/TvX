// Server Connection
export interface ServerConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  lastConnected: number | null;
}

// Content Types
export type ContentType = 'live' | 'movie' | 'series';

// Category
export interface Category {
  id: number;
  name: string;
  parentId: number | null;
  type: ContentType;
}

// Channel (Live TV)
export interface Channel {
  id: number;
  name: string;
  icon: string;
  categoryId: number;
  epgChannelId: string;
  isFavorite: boolean;
}

// Movie (VOD)
export interface Movie {
  id: number;
  name: string;
  poster: string;
  backdrop: string;
  year: string;
  duration: string;
  rating: string;
  plot: string;
  categoryId: number;
  isFavorite: boolean;
}

// Series
export interface Series {
  id: number;
  name: string;
  poster: string;
  backdrop: string;
  year: string;
  rating: string;
  plot: string;
  categoryId: number;
  seasons: Season[];
  isFavorite: boolean;
}

// Season
export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

// Episode
export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  plot: string;
  duration: string;
}

// Unified content item for grids/lists
export type ContentItem =
  | { type: 'live'; data: Channel }
  | { type: 'movie'; data: Movie }
  | { type: 'series'; data: Series };

// User Preferences
export interface UserPreferences {
  theme: 'dark' | 'light';
  defaultView: 'grid' | 'list';
  showOneGroupAtATime: boolean;
  showCopyConfirmation: boolean;
  hideCredentialsInUrl: boolean;
}

// Group visibility state
export interface GroupVisibility {
  [categoryId: number]: boolean;
}

// Watch history entry
export interface WatchHistoryEntry {
  contentType: ContentType;
  contentId: number;
  timestamp: number;
  progress?: number; // For VOD/Series - playback position in seconds
}

// API Response types
export interface AuthResponse {
  user_info: {
    username: string;
    password: string;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    created_at: string;
    max_connections: string;
    allowed_output_formats: string[];
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
}

export interface ApiCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface ApiLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface ApiVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface ApiSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface ApiSeriesInfo {
  seasons: Record<string, ApiEpisode[]>;
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
    backdrop_path: string[];
  };
  episodes: Record<string, ApiEpisode[]>;
}

export interface ApiEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    duration_secs: number;
    duration: string;
    plot: string;
  };
  season: number;
}
