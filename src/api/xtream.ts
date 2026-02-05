// Xtream Codes API Service

import type {
  ServerConnection,
  AuthResponse,
  ApiCategory,
  ApiLiveStream,
  ApiVodStream,
  ApiSeries,
  ApiSeriesInfo,
  Category,
  Channel,
  Movie,
  Series,
  ContentType,
} from '../types';

// Custom error class for API errors
export class XtreamApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isTimeout: boolean = false,
    public isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'XtreamApiError';
  }
}

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 30000;

// API Configuration
interface ApiConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
}

const defaultConfig: ApiConfig = {
  timeout: DEFAULT_TIMEOUT,
  retries: 2,
  retryDelay: 1000,
};

export class XtreamApi {
  private server: ServerConnection;
  private config: ApiConfig;
  private abortController: AbortController | null = null;

  constructor(server: ServerConnection, config: Partial<ApiConfig> = {}) {
    this.server = server;
    this.config = { ...defaultConfig, ...config };
  }

  // Get server info
  getServer(): ServerConnection {
    return this.server;
  }

  // Cancel any pending requests
  cancelPendingRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Build base URL
  private getBaseUrl(): string {
    const url = this.server.url.replace(/\/+$/, '');
    return `${url}/player_api.php`;
  }

  // Build stream base URL (without player_api.php)
  private getStreamBaseUrl(): string {
    return this.server.url.replace(/\/+$/, '');
  }

  // Build query params
  private getAuthParams(): string {
    return `username=${encodeURIComponent(this.server.username)}&password=${encodeURIComponent(this.server.password)}`;
  }

  // Fetch with timeout and retry logic
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<Response> {
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new XtreamApiError(
          `HTTP error: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof XtreamApiError) {
        throw error;
      }

      const err = error as Error;

      // Handle abort/timeout
      if (err.name === 'AbortError') {
        if (retryCount < this.config.retries) {
          await this.delay(this.config.retryDelay);
          return this.fetchWithTimeout(url, options, retryCount + 1);
        }
        throw new XtreamApiError('Request timeout', undefined, true);
      }

      // Handle network errors
      if (err.message.includes('fetch') || err.message.includes('network')) {
        if (retryCount < this.config.retries) {
          await this.delay(this.config.retryDelay);
          return this.fetchWithTimeout(url, options, retryCount + 1);
        }
        throw new XtreamApiError('Network error: Unable to connect to server', undefined, false, true);
      }

      throw new XtreamApiError(err.message || 'Unknown error occurred');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Parse JSON response safely
  private async parseJson<T>(response: Response): Promise<T> {
    try {
      const text = await response.text();
      if (!text || text.trim() === '') {
        return [] as unknown as T;
      }
      return JSON.parse(text);
    } catch {
      throw new XtreamApiError('Invalid JSON response from server');
    }
  }

  // ==================== Authentication ====================

  async authenticate(): Promise<AuthResponse> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}`;
    const response = await this.fetchWithTimeout(url);
    const data = await this.parseJson<AuthResponse>(response);

    // Validate response has required fields
    if (!data.user_info || !data.server_info) {
      throw new XtreamApiError('Invalid authentication response');
    }

    // Check if account is active
    if (data.user_info.status !== 'Active') {
      throw new XtreamApiError(`Account is not active: ${data.user_info.status}`);
    }

    return data;
  }

  // ==================== Categories ====================

  async getLiveCategories(): Promise<ApiCategory[]> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_live_categories`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiCategory[]>(response);
  }

  async getVodCategories(): Promise<ApiCategory[]> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_vod_categories`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiCategory[]>(response);
  }

  async getSeriesCategories(): Promise<ApiCategory[]> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_series_categories`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiCategory[]>(response);
  }

  // ==================== Streams ====================

  async getLiveStreams(categoryId?: number): Promise<ApiLiveStream[]> {
    let url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_live_streams`;
    if (categoryId !== undefined) url += `&category_id=${categoryId}`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiLiveStream[]>(response);
  }

  async getVodStreams(categoryId?: number): Promise<ApiVodStream[]> {
    let url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_vod_streams`;
    if (categoryId !== undefined) url += `&category_id=${categoryId}`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiVodStream[]>(response);
  }

  async getSeries(categoryId?: number): Promise<ApiSeries[]> {
    let url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_series`;
    if (categoryId !== undefined) url += `&category_id=${categoryId}`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiSeries[]>(response);
  }

  // ==================== Details ====================

  async getSeriesInfo(seriesId: number): Promise<ApiSeriesInfo> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_series_info&series_id=${seriesId}`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<ApiSeriesInfo>(response);
  }

  async getVodInfo(vodId: number): Promise<{ info: Record<string, unknown>; movie_data: Record<string, unknown> }> {
    const url = `${this.getBaseUrl()}?${this.getAuthParams()}&action=get_vod_info&vod_id=${vodId}`;
    const response = await this.fetchWithTimeout(url);
    return this.parseJson<{ info: Record<string, unknown>; movie_data: Record<string, unknown> }>(response);
  }

  // ==================== Stream URL Builders ====================

  buildLiveStreamUrl(streamId: number, extension: string = 'm3u8'): string {
    return `${this.getStreamBaseUrl()}/live/${this.server.username}/${this.server.password}/${streamId}.${extension}`;
  }

  buildVodStreamUrl(streamId: number, extension: string): string {
    return `${this.getStreamBaseUrl()}/movie/${this.server.username}/${this.server.password}/${streamId}.${extension}`;
  }

  buildSeriesStreamUrl(episodeId: number, extension: string): string {
    return `${this.getStreamBaseUrl()}/series/${this.server.username}/${this.server.password}/${episodeId}.${extension}`;
  }

  // URL with masked credentials (for display)
  buildLiveStreamUrlMasked(streamId: number, extension: string = 'm3u8'): string {
    return `${this.getStreamBaseUrl()}/live/***/***/***/${streamId}.${extension}`;
  }

  buildVodStreamUrlMasked(streamId: number, extension: string): string {
    return `${this.getStreamBaseUrl()}/movie/***/***/***/${streamId}.${extension}`;
  }

  buildSeriesStreamUrlMasked(episodeId: number, extension: string): string {
    return `${this.getStreamBaseUrl()}/series/***/***/***/${episodeId}.${extension}`;
  }

  // ==================== Data Transformers ====================

  transformCategory(apiCat: ApiCategory, type: ContentType): Category {
    return {
      id: parseInt(apiCat.category_id, 10),
      name: apiCat.category_name,
      parentId: apiCat.parent_id || null,
      type,
    };
  }

  transformCategories(apiCats: ApiCategory[], type: ContentType): Category[] {
    return apiCats.map((cat) => this.transformCategory(cat, type));
  }

  transformChannel(apiStream: ApiLiveStream, favorites: number[] = []): Channel {
    return {
      id: apiStream.stream_id,
      name: apiStream.name,
      icon: apiStream.stream_icon || '',
      categoryId: parseInt(apiStream.category_id, 10),
      epgChannelId: apiStream.epg_channel_id || '',
      isFavorite: favorites.includes(apiStream.stream_id),
    };
  }

  transformChannels(apiStreams: ApiLiveStream[], favorites: number[] = []): Channel[] {
    return apiStreams.map((stream) => this.transformChannel(stream, favorites));
  }

  transformMovie(apiVod: ApiVodStream, favorites: number[] = []): Movie {
    return {
      id: apiVod.stream_id,
      name: apiVod.name,
      poster: apiVod.stream_icon || '',
      backdrop: '',
      year: '',
      duration: '',
      rating: apiVod.rating || '',
      plot: '',
      categoryId: parseInt(apiVod.category_id, 10),
      isFavorite: favorites.includes(apiVod.stream_id),
    };
  }

  transformMovies(apiVods: ApiVodStream[], favorites: number[] = []): Movie[] {
    return apiVods.map((vod) => this.transformMovie(vod, favorites));
  }

  transformSeries(apiSeries: ApiSeries, favorites: number[] = []): Series {
    return {
      id: apiSeries.series_id,
      name: apiSeries.name,
      poster: apiSeries.cover || '',
      backdrop: apiSeries.backdrop_path?.[0] || '',
      year: apiSeries.releaseDate?.split('-')[0] || '',
      rating: apiSeries.rating || '',
      plot: apiSeries.plot || '',
      categoryId: parseInt(apiSeries.category_id, 10),
      seasons: [],
      isFavorite: favorites.includes(apiSeries.series_id),
    };
  }

  transformSeriesList(apiSeriesList: ApiSeries[], favorites: number[] = []): Series[] {
    return apiSeriesList.map((series) => this.transformSeries(series, favorites));
  }
}

// ==================== Singleton Management ====================

let apiInstance: XtreamApi | null = null;

export function initApi(server: ServerConnection, config?: Partial<ApiConfig>): XtreamApi {
  // Clean up previous instance
  if (apiInstance) {
    apiInstance.cancelPendingRequests();
  }
  apiInstance = new XtreamApi(server, config);
  return apiInstance;
}

export function getApi(): XtreamApi | null {
  return apiInstance;
}

export function clearApi(): void {
  if (apiInstance) {
    apiInstance.cancelPendingRequests();
    apiInstance = null;
  }
}

// ==================== Utility Functions ====================

/**
 * Test connection to a server without initializing the global instance
 */
export async function testConnection(server: ServerConnection): Promise<AuthResponse> {
  const api = new XtreamApi(server, { timeout: 15000, retries: 1, retryDelay: 500 });
  try {
    return await api.authenticate();
  } finally {
    api.cancelPendingRequests();
  }
}

/**
 * Get extension for VOD streams
 */
export function getVodExtension(apiVod: ApiVodStream): string {
  return apiVod.container_extension || 'mp4';
}

/**
 * Format expiration date
 */
export function formatExpirationDate(expDate: string): string {
  if (!expDate || expDate === '0' || expDate === 'null') {
    return 'Never';
  }
  const timestamp = parseInt(expDate, 10);
  if (isNaN(timestamp)) return expDate;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

/**
 * Check if account is expired
 */
export function isAccountExpired(expDate: string): boolean {
  if (!expDate || expDate === '0' || expDate === 'null') {
    return false;
  }
  const timestamp = parseInt(expDate, 10);
  if (isNaN(timestamp)) return false;
  return timestamp * 1000 < Date.now();
}
