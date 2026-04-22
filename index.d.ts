/// <reference types="node" />
/**
 * Sweetbook Node.js SDK — TypeScript 타입 정의
 *
 * 핵심 도메인: Books / Covers / Contents / Orders
 * (Photos / Credits / Webhook 타입은 향후 번들에서 추가 예정)
 */

// ============================================================
// 공통 타입
// ============================================================

export interface ClientOptions {
  /** API 키 (SB...) — 필수 */
  apiKey: string;
  /** 베이스 URL 직접 지정 (environment 와 baseUrl 둘 다 없으면 live 기본) */
  baseUrl?: string;
  /** 'sandbox' 또는 'live' (기본: 'live') */
  environment?: "sandbox" | "live";
  /** 요청 타임아웃 (ms, 기본: 30000) */
  timeout?: number;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
}

/** 템플릿 파라미터. 서버에서 Dictionary<string, object> 로 받음. */
export type TemplateParameters = Record<string, unknown>;

/** 템플릿에 첨부하는 파일. Blob / Buffer / ReadStream 등 FormData 가 받을 수 있는 값. */
export type TemplateFile = unknown;

// ============================================================
// Books
// ============================================================

export type CreationType = "TEMPLATE" | "PDF_UPLOAD" | "MIX_COVER_TEMPLATE";

export interface BookCreateRequest {
  /** 상품 스펙 UID (필수) */
  bookSpecUid: string;
  /** 책 제목 (1-255자) */
  title?: string;
  /** 생성 방식 (기본: TEMPLATE) */
  creationType?: CreationType;
  /** 상품 프로필 UID (선택) */
  specProfileUid?: string;
  /** 파트너 외부 참조 식별자 (최대 100자) */
  externalRef?: string;
  /** PDF_UPLOAD / MIX_COVER_TEMPLATE 일 때 필수 */
  pageCount?: number;
  /** 관리자 전용: 대상 사용자 UID */
  AccountUid?: string;
  [extra: string]: unknown;
}

export interface BookCreateResponse {
  bookUid: string;
}

export interface BookListItem {
  bookUid: string;
  accountUid?: string | null;
  title: string;
  author?: string | null;
  status: "draft" | "finalized" | string;
  pageCount: number;
  bookSpecUid?: string | null;
  specProfileUid?: string | null;
  creationType?: string | null;
  createdAt: string;
  updatedAt: string;
  externalRef?: string | null;
  isTest: boolean;
  pdfStatus?: number | null;
  pdfCreatedAt?: string | null;
  pdfRequestedAt?: string | null;
  thumbnailStatus?: number | null;
  [extra: string]: unknown;
}

export interface BooksListResult {
  books: BookListItem[];
  pagination: Pagination;
}

export interface BookListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface BookFinalizationResponse {
  result: string;
  pageCount: number;
  finalizedAt: string;
}

export class BooksClient {
  list(params?: BookListParams): Promise<BooksListResult>;
  create(data: BookCreateRequest): Promise<BookCreateResponse>;
  get(bookUid: string): Promise<BookListItem>;
  finalize(bookUid: string): Promise<BookFinalizationResponse>;
  delete(bookUid: string): Promise<unknown>;
}

// ============================================================
// Covers
// ============================================================

export interface CoverData {
  bookUid: string;
  templateUid?: string;
  pageNum?: number;
  createdAt?: string;
  updatedAt?: string;
  [extra: string]: unknown;
}

export class CoversClient {
  create(
    bookUid: string,
    templateUid: string,
    parameters: TemplateParameters,
    files?: TemplateFile[] | Record<string, TemplateFile>,
  ): Promise<CoverData>;
  get(bookUid: string): Promise<CoverData>;
  delete(bookUid: string): Promise<unknown>;
}

// ============================================================
// Contents
// ============================================================

export type BreakBefore = "page" | "spread" | string;

export interface ContentInsertOptions {
  /** 템플릿에 첨부할 이미지 파일 (선택) */
  files?: TemplateFile[] | Record<string, TemplateFile>;
  /** 페이지/스프레드 단위 페이지 나눔 (선택) */
  breakBefore?: BreakBefore;
}

export interface ContentInsertResult {
  /** 삽입된 페이지 번호 (서버 cursor.pageNum) */
  pageNum?: number;
  /** 페이지 사이드 (서버 cursor.pageSide) */
  pageSide?: string;
  [extra: string]: unknown;
}

export class ContentsClient {
  insert(
    bookUid: string,
    templateUid: string,
    parameters: TemplateParameters,
    options?: ContentInsertOptions,
  ): Promise<ContentInsertResult>;
  clear(bookUid: string): Promise<unknown>;
}

// ============================================================
// Orders
// ============================================================

export interface OrderItemRequest {
  bookUid: string;
  /** 수량 (1-100) */
  quantity?: number;
}

export interface ShippingRequest {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  memo?: string;
}

export interface CreateOrderRequest {
  items: OrderItemRequest[];
  shipping: ShippingRequest;
  externalRef?: string;
  externalUserId?: string;
}

export interface EstimateItemRequest {
  bookUid: string;
  /** 수량 (1-100) */
  quantity?: number;
}

export interface EstimateRequest {
  items: EstimateItemRequest[];
}

export interface EstimateItemResponse {
  bookUid: string;
  bookSpecUid: string;
  pageCount: number;
  quantity: number;
  unitPrice: number;
  itemAmount: number;
  packagingFee: number;
}

export interface EstimateResponse {
  items: EstimateItemResponse[];
  productAmount: number;
  shippingFee: number;
  packagingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  creditBalance: number;
  creditSufficient: boolean;
  currency: string;
}

export interface OrderListItem {
  orderUid: string;
  accountUid: string;
  orderType: string;
  externalRef?: string | null;
  orderStatus: number;
  orderStatusDisplay: string;
  totalAmount: number;
  paidCreditAmount: number;
  paymentMethod: string;
  itemCount: number;
  recipientName: string;
  isTest: boolean;
  orderedAt: string;
  createdAt: string;
  [extra: string]: unknown;
}

export interface OrderListResponse {
  orders: OrderListItem[];
  pagination: Pagination;
}

export interface OrderListParams {
  limit?: number;
  offset?: number;
  status?: string;
  from?: string;
  to?: string;
}

export interface OrderItemDetail {
  itemUid: string;
  bookUid: string;
  bookTitle?: string | null;
  bookSpecUid: string;
  bookSpecName?: string | null;
  quantity: number;
  pageCount: number;
  unitPrice: number;
  itemAmount: number;
  itemStatus: number;
  itemStatusDisplay: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedAt?: string | null;
  createdAt: string;
  [extra: string]: unknown;
}

export interface OrderDetailResponse {
  orderUid: string;
  accountUid: string;
  orderType: string;
  externalRef?: string | null;
  orderStatus: number;
  orderStatusDisplay: string;
  isTest: boolean;
  totalProductAmount: number;
  totalShippingFee: number;
  totalPackagingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  paymentMethod: string;
  creditBalanceAfter?: number | null;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string | null;
  shippingMemo?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  cancelReason?: string | null;
  refundAmount?: number | null;
  orderedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  items: OrderItemDetail[];
  [extra: string]: unknown;
}

export interface UpdateShippingRequest {
  recipientName?: string;
  recipientPhone?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  shippingMemo?: string;
}

export class OrdersClient {
  estimate(data: EstimateRequest): Promise<EstimateResponse>;
  create(data: CreateOrderRequest): Promise<OrderDetailResponse>;
  list(params?: OrderListParams): Promise<OrderListResponse>;
  get(orderUid: string): Promise<OrderDetailResponse>;
  cancel(orderUid: string, cancelReason: string): Promise<OrderDetailResponse>;
  updateShipping(
    orderUid: string,
    shippingData: UpdateShippingRequest,
  ): Promise<OrderDetailResponse>;
}

// ============================================================
// Photos / Credits — 향후 번들 대상, 현재는 느슨한 타입으로만 노출
// ============================================================

export interface PhotosClient {
  upload(
    bookUid: string,
    file: TemplateFile,
    options?: { preserveExif?: boolean },
  ): Promise<Record<string, unknown>>;
  list(bookUid: string): Promise<Record<string, unknown>>;
  delete(bookUid: string, fileName: string): Promise<unknown>;
}

export interface CreditsClient {
  getBalance(): Promise<Record<string, unknown>>;
  transactions(params?: {
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  }): Promise<Record<string, unknown>>;
  sandboxCharge(amount: number, memo?: string): Promise<Record<string, unknown>>;
}

// ============================================================
// 메인 클라이언트 / 에러
// ============================================================

export class SweetbookClient {
  constructor(options: ClientOptions);
  readonly books: BooksClient;
  readonly covers: CoversClient;
  readonly contents: ContentsClient;
  readonly orders: OrdersClient;
  readonly photos: PhotosClient;
  readonly credits: CreditsClient;
}

export class SweetbookApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export class SweetbookNetworkError extends Error {
  cause?: unknown;
}

export class SweetbookValidationError extends Error {
  field?: string;
  constructor(message: string, field?: string);
}

export class ResponseParser {
  constructor(body: unknown);
  getData(): unknown;
  getDict(): Record<string, unknown>;
}

// ============================================================
// 웹훅
// ============================================================

/**
 * 웹훅 서명 검증 (HMAC-SHA256).
 * @returns 유효하면 true, 아니면 false
 */
export function verifySignature(
  body: string | Buffer,
  signatureHeader: string,
  secret: string,
): boolean;
