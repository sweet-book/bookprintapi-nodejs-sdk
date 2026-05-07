/**
 * Sweetbook SDK 헬퍼 — 다단계 플로우 한 호출
 *
 * 11_sdk_helpers_design.md v0.1 구현.
 *
 * - createBookFromTemplate: TEMPLATE 모드 책 + 표지 + 내지 N + finalize
 * - uploadPdfAndOrder:      PDF_UPLOAD 모드 책 + PDF 2종 + finalize + 견적 + 주문
 *
 * 설계 §4.1 정책:
 * - 자동 재시도 안 함 (트랜스포트 레이어 재시도만)
 * - 자동 롤백 안 함 — 실패 시 SweetbookHelperError 의 bookUid / partial 노출.
 *   파트너가 client.books.delete(bookUid) 등으로 명시적 cleanup
 */

const {
  SweetbookApiError,
  SweetbookHelperError,
  HelperStage,
  HelperErrorCodes,
} = require('./core');

class HelpersClient {
  /**
   * @param {object} client SweetbookClient 인스턴스 — books/covers/contents/orders/pdfs 사용
   */
  constructor(client) {
    this._client = client;
  }

  // ====================================================================
  // createBookFromTemplate
  // ====================================================================

  /**
   * TEMPLATE 모드 책 한 권을 한 호출로 생성.
   *
   * 내부 호출 순서:
   *   1. books.create({ bookSpecUid, title, creationType: 'TEMPLATE', externalRef })
   *   2. covers.create(bookUid, coverTemplateUid, coverParams, { bindingFiles })
   *   3. for c of contents: contents.insert(bookUid, c.templateUid, c.params, { bindingFiles, breakBefore })
   *   4. books.finalize(bookUid)  (skipFinalize=true 면 건너뜀)
   *
   * @param {object} input
   * @param {{uid: string}} input.bookSpec
   * @param {{templateUid: string, params?: object, bindingFiles?: object}} input.cover
   * @param {Array<{templateUid: string, params?: object, bindingFiles?: object, breakBefore?: 'page'|'spread'|'column'}>} input.contents
   * @param {object} [input.options]
   * @param {string} [input.options.title]
   * @param {string} [input.options.externalRef]
   * @param {string} [input.options.specProfileUid]
   * @param {boolean} [input.options.skipFinalize=false]
   * @returns {Promise<BookBuildResult>}
   */
  async createBookFromTemplate(input = {}) {
    const { bookSpec, cover, contents, options = {} } = input;

    // 클라이언트측 검증
    if (!bookSpec || !bookSpec.uid) {
      throw new SweetbookHelperError('bookSpec.uid 필수', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }
    if (!cover || !cover.templateUid) {
      throw new SweetbookHelperError('cover.templateUid 필수', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }
    const contentList = Array.isArray(contents) ? contents : [];
    if (contentList.length === 0) {
      throw new SweetbookHelperError('contents 는 최소 1개 이상이어야 합니다', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }

    const partial = {
      bookCreated: false,
      coverCreated: false,
      contentsInserted: [],
      finalized: false,
    };
    let bookUid = null;

    // 1. books.create
    let book;
    try {
      book = await this._client.books.create({
        bookSpecUid: bookSpec.uid,
        title: options.title,
        creationType: 'TEMPLATE',
        externalRef: options.externalRef,
        specProfileUid: options.specProfileUid,
      });
    } catch (e) {
      throw new SweetbookHelperError('책 생성 실패', {
        stage: HelperStage.BOOK_CREATE,
        code: HelperErrorCodes.BOOK_CREATE_FAILED,
        partial, cause: e,
      });
    }
    bookUid = book?.bookUid || book?.data?.bookUid || null;
    if (!bookUid) {
      throw new SweetbookHelperError('books.create 응답에 bookUid 없음', {
        stage: HelperStage.BOOK_CREATE,
        code: HelperErrorCodes.BOOK_CREATE_FAILED,
        partial,
      });
    }
    partial.bookCreated = true;

    // 2. covers.create
    let coverResp;
    try {
      coverResp = await this._client.covers.create(
        bookUid,
        cover.templateUid,
        cover.params || {},
        { bindingFiles: cover.bindingFiles },
      );
    } catch (e) {
      throw new SweetbookHelperError('표지 생성 실패', {
        stage: HelperStage.COVER_CREATE,
        code: HelperErrorCodes.COVER_CREATE_FAILED,
        bookUid, partial, cause: e,
      });
    }
    partial.coverCreated = true;
    const coverPageNum = coverResp?.pageNum ?? coverResp?.data?.pageNum ?? null;

    // 3. contents.insert (반복)
    for (let idx = 0; idx < contentList.length; idx++) {
      const page = contentList[idx];
      if (!page.templateUid) {
        throw new SweetbookHelperError(`contents[${idx}].templateUid 누락`, {
          stage: HelperStage.CONTENT_INSERT,
          code: HelperErrorCodes.CONTENT_INSERT_FAILED,
          bookUid, partial, contentIndex: idx,
        });
      }
      let resp;
      try {
        resp = await this._client.contents.insert(
          bookUid,
          page.templateUid,
          page.params || {},
          {
            bindingFiles: page.bindingFiles,
            breakBefore: page.breakBefore,
          },
        );
      } catch (e) {
        throw new SweetbookHelperError(`내지 페이지 #${idx} 삽입 실패`, {
          stage: HelperStage.CONTENT_INSERT,
          code: HelperErrorCodes.CONTENT_INSERT_FAILED,
          bookUid, partial, cause: e, contentIndex: idx,
        });
      }
      partial.contentsInserted.push({
        pageNum: resp?.pageNum ?? resp?.data?.pageNum ?? null,
        pageSide: resp?.pageSide ?? resp?.data?.pageSide ?? null,
      });
    }

    // 4. books.finalize
    let finalizeResp = null;
    if (!options.skipFinalize) {
      try {
        finalizeResp = await this._client.books.finalize(bookUid);
      } catch (e) {
        throw new SweetbookHelperError('책 확정(finalize) 실패', {
          stage: HelperStage.BOOK_FINALIZE,
          code: HelperErrorCodes.FINALIZE_FAILED,
          bookUid, partial, cause: e,
        });
      }
      partial.finalized = true;
    }

    let pageCount = null;
    if (finalizeResp) {
      const fd = finalizeResp.data ?? finalizeResp;
      pageCount = fd?.pageMeta?.currentPageCount ?? fd?.pageCount ?? null;
    }

    return {
      bookUid,
      coverPageNum,
      contentPages: partial.contentsInserted,
      finalized: partial.finalized,
      pageCount,
      raw: { book, cover: coverResp, finalize: finalizeResp },
    };
  }

  // ====================================================================
  // uploadPdfAndOrder
  // ====================================================================

  /**
   * PDF_UPLOAD 모드 책 + PDF 2종 + finalize + 주문까지 한 호출로.
   *
   * @param {object} input
   * @param {{uid: string, pageCount: number}} input.bookSpec
   * @param {{cover: any, contents: any}} input.pdfs - File/Blob/Buffer
   * @param {object} input.order
   * @param {object} input.order.shipping - {recipientName, recipientPhone, postalCode, address1, ...}
   * @param {number} [input.order.quantity=1]
   * @param {string} [input.order.externalRef]
   * @param {object} [input.options]
   * @param {string} [input.options.title]
   * @param {string} [input.options.bookExternalRef]
   * @param {string} [input.options.specProfileUid]
   * @param {boolean} [input.options.failOnInsufficientCredit=true]
   * @param {boolean} [input.options.skipEstimate=false]
   * @returns {Promise<PdfOrderBuildResult>}
   */
  async uploadPdfAndOrder(input = {}) {
    const { bookSpec, pdfs, order, options = {} } = input;
    const failOnInsufficientCredit = options.failOnInsufficientCredit !== false;
    const skipEstimate = options.skipEstimate === true;

    // 검증
    if (!bookSpec || !bookSpec.uid) {
      throw new SweetbookHelperError('bookSpec.uid 필수', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }
    if (!Number.isInteger(bookSpec.pageCount) || bookSpec.pageCount < 1) {
      throw new SweetbookHelperError('bookSpec.pageCount >= 1 필요', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }
    if (!pdfs || !pdfs.cover || !pdfs.contents) {
      throw new SweetbookHelperError('pdfs.cover / pdfs.contents 둘 다 필수', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }
    if (!order || !order.shipping || !order.shipping.recipientName) {
      throw new SweetbookHelperError('order.shipping.recipientName 비어있음', {
        stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
      });
    }

    const partial = {
      bookCreated: false,
      coverPdfUploaded: false,
      contentsPdfUploaded: false,
      finalized: false,
      estimate: null,
    };

    // 1. books.create
    let book;
    try {
      book = await this._client.books.create({
        bookSpecUid: bookSpec.uid,
        title: options.title,
        creationType: 'PDF_UPLOAD',
        pageCount: bookSpec.pageCount,
        externalRef: options.bookExternalRef,
        specProfileUid: options.specProfileUid,
      });
    } catch (e) {
      throw new SweetbookHelperError('책 생성 실패', {
        stage: HelperStage.BOOK_CREATE,
        code: HelperErrorCodes.BOOK_CREATE_FAILED,
        partial, cause: e,
      });
    }
    const bookUid = book?.bookUid || book?.data?.bookUid;
    if (!bookUid) {
      throw new SweetbookHelperError('books.create 응답에 bookUid 없음', {
        stage: HelperStage.BOOK_CREATE,
        code: HelperErrorCodes.BOOK_CREATE_FAILED, partial,
      });
    }
    partial.bookCreated = true;

    // 2. pdfs.uploadCover
    let coverPdf;
    try {
      coverPdf = await this._client.pdfs.uploadCover(bookUid, pdfs.cover);
    } catch (e) {
      throw new SweetbookHelperError('표지 PDF 업로드 실패', {
        stage: HelperStage.PDF_UPLOAD_COVER,
        code: HelperErrorCodes.PDF_UPLOAD_FAILED,
        bookUid, partial, cause: e,
      });
    }
    partial.coverPdfUploaded = true;

    // 3. pdfs.uploadContents
    let contentsPdf;
    try {
      contentsPdf = await this._client.pdfs.uploadContents(bookUid, pdfs.contents);
    } catch (e) {
      throw new SweetbookHelperError('내지 PDF 업로드 실패', {
        stage: HelperStage.PDF_UPLOAD_CONTENTS,
        code: HelperErrorCodes.PDF_UPLOAD_FAILED,
        bookUid, partial, cause: e,
      });
    }
    partial.contentsPdfUploaded = true;

    // 4. books.finalize
    try {
      await this._client.books.finalize(bookUid);
    } catch (e) {
      throw new SweetbookHelperError('책 확정(finalize) 실패', {
        stage: HelperStage.BOOK_FINALIZE,
        code: HelperErrorCodes.FINALIZE_FAILED,
        bookUid, partial, cause: e,
      });
    }
    partial.finalized = true;

    const quantity = order.quantity || 1;
    const items = [{ bookUid, quantity }];

    // 5. orders.estimate (선택)
    let estimate = null;
    if (!skipEstimate) {
      try {
        estimate = await this._client.orders.estimate({ items });
      } catch (e) {
        throw new SweetbookHelperError('견적 조회 실패', {
          stage: HelperStage.ORDER_ESTIMATE,
          code: HelperErrorCodes.ORDER_ESTIMATE_FAILED,
          bookUid, partial, cause: e,
        });
      }
      partial.estimate = estimate;

      if (failOnInsufficientCredit) {
        const ed = estimate?.data ?? estimate ?? {};
        if (ed.creditSufficient === false) {
          const required = ed.paidCreditAmount ?? 0;
          const balance = ed.creditBalance ?? 0;
          throw new SweetbookHelperError(
            `충전금 부족: 필요 ${required}, 잔액 ${balance}`,
            {
              stage: HelperStage.ORDER_ESTIMATE,
              code: HelperErrorCodes.CREDIT_INSUFFICIENT,
              bookUid, partial,
            },
          );
        }
      }
    }

    // 6. orders.create
    let orderResp;
    try {
      orderResp = await this._client.orders.create({
        items,
        shipping: order.shipping,
        externalRef: order.externalRef,
      });
    } catch (e) {
      throw new SweetbookHelperError('주문 생성 실패', {
        stage: HelperStage.ORDER_CREATE,
        code: HelperErrorCodes.ORDER_CREATE_FAILED,
        bookUid, partial, cause: e,
      });
    }

    const orderUid = orderResp?.orderUid ?? orderResp?.data?.orderUid ?? null;

    return {
      bookUid,
      coverPdf,
      contentsPdf,
      finalized: true,
      estimate,
      order: orderResp,
      orderUid,
    };
  }
}

module.exports = { HelpersClient };
