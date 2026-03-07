import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface JulesClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export class JulesClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor(options: JulesClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://jules.googleapis.com/v1alpha';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Implement simple retry interceptor
    const maxRetries = options.retries || 3;
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config || !maxRetries) return Promise.reject(error);

        config.__retryCount = config.__retryCount || 0;

        if (config.__retryCount >= maxRetries) {
          return Promise.reject(error);
        }

        // Retry on 429 or 5xx
        if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
          config.__retryCount += 1;
          const backoff = Math.pow(2, config.__retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoff));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async listSources(pageSize: number = 30, pageToken?: string, filterExpr?: string): Promise<any> {
    const params: any = { pageSize };
    if (pageToken) params.pageToken = pageToken;
    if (filterExpr) params.filter = filterExpr;

    try {
      const response = await this.client.get('/sources', { params });
      return response.data;
    } catch (error: any) {
      this._handleError('listing sources', error);
    }
  }

  async getSource(sourceId: string): Promise<any> {
    try {
      const response = await this.client.get(`/sources/${sourceId}`);
      return response.data;
    } catch (error: any) {
      this._handleError(`getting source ${sourceId}`, error);
    }
  }

  async createSession(payload: any): Promise<any> {
    try {
      const response = await this.client.post('/sessions', payload);
      return response.data;
    } catch (error: any) {
      this._handleError('creating session', error);
    }
  }

  async listSessions(pageSize: number = 30, pageToken?: string, filterExpr?: string): Promise<any> {
    const params: any = { pageSize };
    if (pageToken) params.pageToken = pageToken;
    if (filterExpr) params.filter = filterExpr;

    try {
      const response = await this.client.get('/sessions', { params });
      return response.data;
    } catch (error: any) {
      this._handleError('listing sessions', error);
    }
  }

  async getSession(sessionId: string): Promise<any> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      this._handleError(`getting session ${sessionId}`, error);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await this.client.delete(`/sessions/${sessionId}`);
      return true;
    } catch (error: any) {
      this._handleError(`deleting session ${sessionId}`, error);
      return false;
    }
  }

  async archiveSession(sessionId: string): Promise<boolean> {
    try {
      await this.client.post(`/sessions/${sessionId}:archive`, {});
      return true;
    } catch (error: any) {
      this._handleError(`archiving session ${sessionId}`, error);
      return false;
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<any> {
    try {
      const response = await this.client.post(`/sessions/${sessionId}:sendMessage`, { prompt: message });
      return response.data;
    } catch (error: any) {
      this._handleError(`sending message to session ${sessionId}`, error);
    }
  }

  async approvePlan(sessionId: string): Promise<any> {
    try {
      const response = await this.client.post(`/sessions/${sessionId}:approvePlan`, {});
      return response.data;
    } catch (error: any) {
      this._handleError(`approving plan for session ${sessionId}`, error);
    }
  }

  async listActivities(sessionId: string, pageSize: number = 50, pageToken?: string, filterExpr?: string): Promise<any> {
    const params: any = { pageSize };
    if (pageToken) params.pageToken = pageToken;
    if (filterExpr) params.filter = filterExpr;

    try {
      const response = await this.client.get(`/sessions/${sessionId}/activities`, { params });
      return response.data;
    } catch (error: any) {
      this._handleError(`listing activities for session ${sessionId}`, error);
    }
  }

  async getActivity(sessionId: string, activityId: string): Promise<any> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/activities/${activityId}`);
      return response.data;
    } catch (error: any) {
      this._handleError(`getting activity ${activityId} for session ${sessionId}`, error);
    }
  }

  private _handleError(action: string, error: any): never {
    let details = '';
    if (error.response && error.response.data) {
      details = JSON.stringify(error.response.data);
    } else {
      details = error.message;
    }
    console.error(`Error ${action}: ${error.message}`);
    if (details) console.error(`Details: ${details}`);
    throw error;
  }
}
