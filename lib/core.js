/**
 * Sweetbook JavaScript SDK — Core
 * 공통 기반: Error, ResponseParser, BaseClient
 */

// ============================================================
// Errors
// ============================================================

/**
 * fieldErrors[] 항목 — master_대비_변경사항.md § 1.3
 */
class FieldError {
  constructor({ field, message, currentValue, requiredValue, constraint } = {}) {
    this.field = field || '';
    this.message = message || '';
    this.currentValue = currentValue !== undefined ? currentValue : null;
    this.requiredValue = requiredValue !== undefined ? requiredValue : null;
    this.constraint = constraint || null;
  }

  static from(obj) {
    if (obj instanceof FieldError) return obj;
    if (!obj || typeof obj !== 'object') return null;
    return new FieldError(obj);
  }
}

class SweetbookApiError extends Error {
  /**
   * 6필드 응답 shape 기반 (master_대비_변경사항.md § 1.2):
   * { success, errorCode, message, data, errors[], fieldErrors[] }
   */
  constructor(
    message,
    { errorCode, statusCode, details, fieldErrors, data, response } = {},
  ) {
    super(message);
    this.name = 'SweetbookApiError';
    this.errorCode = errorCode || null;
    this.statusCode = statusCode || null;
    this.details = details || null;          // errors[] (한글 메시지 배열)
    this.fieldErrors = fieldErrors || [];    // FieldError[]
    this.data = data !== undefined ? data : null; // 일부 errorCode에서 진단 객체
    this.response = response || null;
  }

  /**
   * field 이름으로 FieldError 찾기. 없으면 null.
   */
  fieldError(name) {
    return this.fieldErrors.find((fe) => fe && fe.field === name) || null;
  }

  /**
   * 사용자에게 표시할 한글 메시지 (errors[0]) 또는 영어 라벨 fallback.
   */
  userMessage() {
    if (Array.isArray(this.details) && this.details.length > 0) {
      return this.details[0];
    }
    return this.message;
  }

  static async fromResponse(response) {
    let body = null;
    try { body = await response.json(); } catch (e) { /* ignore */ }
    // 표준 6필드 shape + 구버전 fallback (snake_case error_code, error: {...})
    const legacyErr = body?.error;
    const message = body?.message || legacyErr?.message || `HTTP ${response.status}`;
    const errorCode = body?.errorCode || body?.error_code || legacyErr?.code || null;
    const details = Array.isArray(body?.errors)
      ? body.errors
      : (legacyErr?.details || null);

    const rawFieldErrors = Array.isArray(body?.fieldErrors)
      ? body.fieldErrors
      : (Array.isArray(body?.field_errors) ? body.field_errors : []);
    const fieldErrors = rawFieldErrors
      .map((fe) => FieldError.from(fe))
      .filter(Boolean);

    return new SweetbookApiError(message, {
      errorCode,
      statusCode: response.status,
      details,
      fieldErrors,
      data: body?.data ?? null,
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

  get success() {
    return Boolean(this.body?.success);
  }

  getData() {
    return this.body?.data ?? this.body;
  }

  getList() {
    const d = this.getData();
    if (Array.isArray(d)) return d;
    // 구버전 호환: data: { orders|items|books|...: [...] }
    if (d && typeof d === 'object') {
      for (const k of ['orders', 'items', 'books', 'templates', 'photos']) {
        if (Array.isArray(d[k])) return d[k];
      }
    }
    return [];
  }

  getDict() {
    const d = this.getData();
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }

  getMeta() {
    return this.body?.meta || {};
  }

  /**
   * pagination 메타. 평탄화 응답에서 최상위 우선, 구버전은 data.pagination 또는 meta.pagination.
   */
  getPagination() {
    if (this.body?.pagination && typeof this.body.pagination === 'object') {
      return this.body.pagination;
    }
    const d = this.getData();
    if (d && typeof d === 'object' && !Array.isArray(d) && d.pagination) {
      return d.pagination;
    }
    return this.getMeta().pagination || {};
  }

  /** errorCode (camelCase 우선, snake_case fallback) */
  getErrorCode() {
    return this.body?.errorCode || this.body?.error_code || null;
  }

  /** errors[] — 사용자 표시용 한글 메시지 배열 */
  getErrors() {
    return Array.isArray(this.body?.errors) ? this.body.errors : [];
  }

  /** fieldErrors[] — FieldError 객체 배열 */
  getFieldErrors() {
    const raw = Array.isArray(this.body?.fieldErrors)
      ? this.body.fieldErrors
      : (Array.isArray(this.body?.field_errors) ? this.body.field_errors : []);
    return raw.map((fe) => FieldError.from(fe)).filter(Boolean);
  }

  getFieldError(field) {
    return this.getFieldErrors().find((fe) => fe.field === field) || null;
  }

  /** data.pageMeta (책 생성·내지·표지·finalize·PDF 응답) */
  getPageMeta() {
    const d = this.getDict();
    return (d.pageMeta && typeof d.pageMeta === 'object') ? d.pageMeta : {};
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
  FieldError,
  SweetbookApiError,
  SweetbookNetworkError,
  SweetbookValidationError,
  ResponseParser,
  BaseClient,
  generateUuid,
};
