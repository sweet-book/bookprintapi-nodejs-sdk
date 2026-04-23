/**
 * Sweetbook JavaScript SDK — Core
 * 공통 기반: Error, ResponseParser, BaseClient
 */

// ============================================================
// Errors
// ============================================================

class SweetbookApiError extends Error {
  constructor(message, { errorCode, statusCode, details, response } = {}) {
    super(message);
    this.name = 'SweetbookApiError';
    this.errorCode = errorCode || null;
    this.statusCode = statusCode || null;
    this.details = details || null;
    this.response = response || null;
  }

  static async fromResponse(response) {
    let body = null;
    try { body = await response.json(); } catch (e) { /* ignore */ }
    // 서버 표준 ApiResponse.Fail 형식: { success, message, errors: [], error_code? }
    // 일부 구버전 경로: { error: { message, code, details } }
    const legacyErr = body?.error;
    const message = body?.message || legacyErr?.message || `HTTP ${response.status}`;
    const errorCode = body?.error_code || body?.errorCode || legacyErr?.code || null;
    const details = Array.isArray(body?.errors) ? body.errors
                  : (legacyErr?.details || null);
    return new SweetbookApiError(message, {
      errorCode,
      statusCode: response.status,
      details,
      response,
    });
  }
}

class SweetbookNetworkError extends Error {
  constructor(message, { originalError } = {}) {
    super(message);
    this.name = 'SweetbookNetworkError';
    this.originalError = originalError || null;
  }
}

class SweetbookValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'SweetbookValidationError';
    this.field = field || null;
  }
}

// ============================================================
// Response Parser
// ============================================================

class ResponseParser {
  constructor(body) {
    this.body = body;
  }

  getData() {
    return this.body?.data ?? this.body;
  }

  getList() {
    const d = this.getData();
    return Array.isArray(d) ? d : [];
  }

  getDict() {
    const d = this.getData();
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }

  getMeta() {
    return this.body?.meta || {};
  }

  getPagination() {
    return this.getMeta().pagination || {};
  }
}

// ============================================================
// UUID generator (simple v4-like)
// ============================================================

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ============================================================
// Base HTTP Client
// ============================================================

class BaseClient {
  constructor(sweetbookClient) {
    this._client = sweetbookClient;
  }

  _getApiKey(useAdmin = false) {
    if (useAdmin && this._client._adminApiKey) {
      return this._client._adminApiKey;
    }
    return this._client._apiKey;
  }

  _buildTemplateFormData(templateUid, parameters, files, fileFieldName = 'files') {
    const fd = new FormData();
    fd.append('templateUid', templateUid);
    fd.append('parameters', JSON.stringify(parameters));
    if (files && files.length > 0) {
      for (const f of files) {
        fd.append(fileFieldName, f);
      }
    }
    return fd;
  }

  _requireParam(value, name) {
    if (value === undefined || value === null || value === '') {
      throw new SweetbookValidationError(`${name} is required`, name);
    }
  }

  async _request(method, path, { payload, formData, params, useAdmin } = {}) {
    const baseUrl = this._client._baseUrl.replace(/\/+$/, '');
    const urlPath = path.startsWith('/') ? path : `/${path}`;

    // Build query string
    let queryString = '';
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      if (qs) queryString = `?${qs}`;
    }

    const fullUrl = `${baseUrl}${urlPath}${queryString}`;

    const headers = {};
    const fetchOptions = { method, headers };

    if (this._client._useCookie) {
      fetchOptions.credentials = 'include';
    } else {
      headers['Authorization'] = `Bearer ${this._getApiKey(useAdmin)}`;
      headers['Idempotency-Key'] = generateUuid();
    }

    if (formData) {
      fetchOptions.body = formData;
    } else if (payload !== undefined && payload !== null) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(payload);
    }

    const timeout = this._client._timeout;
    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise(r => setTimeout(r, delay));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      fetchOptions.signal = controller.signal;

      let response;
      try {
        response = await fetch(fullUrl, fetchOptions);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          lastError = new SweetbookNetworkError(`Request timed out after ${timeout}ms`, { originalError: err });
        } else {
          lastError = new SweetbookNetworkError(`Network request failed: ${err.message}`, { originalError: err });
        }
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        lastError = await SweetbookApiError.fromResponse(response);
        continue;
      }

      if (!response.ok) {
        throw await SweetbookApiError.fromResponse(response);
      }

      const text = await response.text();
      if (!text) return null;

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    throw lastError;
  }

  async _get(path, params, options) {
    return this._request('GET', path, { params, ...options });
  }

  async _post(path, payload, options) {
    return this._request('POST', path, { payload, ...options });
  }

  async _postForm(path, formData, options) {
    return this._request('POST', path, { formData, ...options });
  }

  async _putForm(path, formData, options) {
    return this._request('PUT', path, { formData, ...options });
  }

  async _patch(path, payload, options) {
    return this._request('PATCH', path, { payload, ...options });
  }

  async _delete(path, params, options) {
    return this._request('DELETE', path, { params, ...options });
  }

  /**
   * 바이너리 다운로드. 반환값은 Buffer (Node) 또는 ArrayBuffer.
   * 재시도 없이 단일 요청 — 스트리밍 응답 중간에 재시도하면 손상될 수 있음.
   */
  async _downloadBinary(path, { useAdmin } = {}) {
    const baseUrl = this._client._baseUrl.replace(/\/+$/, '');
    const urlPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${urlPath}`;

    const headers = {};
    if (this._client._useCookie) {
      // credentials 는 fetch 옵션에서 처리
    } else {
      headers['Authorization'] = `Bearer ${this._getApiKey(useAdmin)}`;
      headers['Idempotency-Key'] = generateUuid();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._client._timeout);

    let response;
    try {
      response = await fetch(fullUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        credentials: this._client._useCookie ? 'include' : 'same-origin',
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new SweetbookNetworkError(`Request timed out after ${this._client._timeout}ms`, { originalError: err });
      }
      throw new SweetbookNetworkError(`Network request failed: ${err.message}`, { originalError: err });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw await SweetbookApiError.fromResponse(response);
    }

    const buf = await response.arrayBuffer();
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buf);
    }
    return buf;
  }
}

module.exports = {
  SweetbookApiError,
  SweetbookNetworkError,
  SweetbookValidationError,
  ResponseParser,
  BaseClient,
  generateUuid,
};
