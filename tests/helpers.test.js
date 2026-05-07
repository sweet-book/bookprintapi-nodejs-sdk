/**
 * lib/helpers.js 단위 테스트.
 *
 * Node 내장 test runner 사용 (node 18+ : node --test tests/).
 * sub-client 를 mock 으로 대체하여 헬퍼 로직만 검증.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HelpersClient,
} = require('../lib/helpers');
const {
  SweetbookApiError,
  SweetbookHelperError,
  HelperStage,
  HelperErrorCodes,
} = require('../lib/core');

/** 호출 횟수/인자/반환을 제어할 수 있는 mock 메서드 팩토리. */
function mockFn(impl) {
  const calls = [];
  const fn = function (...args) {
    calls.push(args);
    if (typeof impl === 'function') return impl(...args);
    return impl;
  };
  fn.calls = calls;
  fn.callCount = () => calls.length;
  return fn;
}

function buildMockClient({ withPdfs = false } = {}) {
  const client = {
    books: {
      create: mockFn(),
      finalize: mockFn(),
      delete: mockFn(),
    },
    covers: { create: mockFn() },
    contents: { insert: mockFn() },
    orders: { estimate: mockFn(), create: mockFn() },
  };
  if (withPdfs) {
    client.pdfs = {
      uploadCover: mockFn(),
      uploadContents: mockFn(),
    };
  }
  return client;
}

function withReturn(fn, value) {
  return mockFn(async () => value);
}

function withReturns(fn, values) {
  let i = 0;
  return mockFn(async () => values[i++]);
}

function withThrow(error) {
  return mockFn(async () => { throw error; });
}

// =============================================================================
// createBookFromTemplate
// =============================================================================

test('createBookFromTemplate happy path', async () => {
  const client = buildMockClient();
  client.books.create = withReturn(null, { bookUid: 'bk_test' });
  client.covers.create = withReturn(null, { pageNum: 1 });
  client.contents.insert = withReturns(null, [
    { pageNum: 2, pageSide: 'left' },
    { pageNum: 3, pageSide: 'right' },
  ]);
  client.books.finalize = withReturn(null, {
    data: { pageMeta: { currentPageCount: 4 } },
  });

  const helpers = new HelpersClient(client);
  const result = await helpers.createBookFromTemplate({
    bookSpec: { uid: 'PHOTOBOOK_A4_SC' },
    cover: { templateUid: 'cv1', params: { title: 'T' } },
    contents: [
      { templateUid: 'p1', params: {} },
      { templateUid: 'p2', params: {}, breakBefore: 'page' },
    ],
    options: { title: 'My Book' },
  });

  assert.equal(result.bookUid, 'bk_test');
  assert.equal(result.coverPageNum, 1);
  assert.equal(result.contentPages.length, 2);
  assert.equal(result.contentPages[0].pageSide, 'left');
  assert.equal(result.finalized, true);
  assert.equal(result.pageCount, 4);

  // books.create 호출 인자 검증
  const createArgs = client.books.create.calls[0][0];
  assert.equal(createArgs.bookSpecUid, 'PHOTOBOOK_A4_SC');
  assert.equal(createArgs.creationType, 'TEMPLATE');
  assert.equal(createArgs.title, 'My Book');

  // contents.insert 의 두 번째 호출에 breakBefore 전달
  const insertArgs = client.contents.insert.calls[1];
  assert.equal(insertArgs[3].breakBefore, 'page');
});

test('createBookFromTemplate skipFinalize', async () => {
  const client = buildMockClient();
  client.books.create = withReturn(null, { bookUid: 'bk_skip' });
  client.covers.create = withReturn(null, {});
  client.contents.insert = withReturn(null, { pageNum: 2 });

  const result = await new HelpersClient(client).createBookFromTemplate({
    bookSpec: { uid: 'X' },
    cover: { templateUid: 'cv' },
    contents: [{ templateUid: 'p', params: {} }],
    options: { skipFinalize: true },
  });
  assert.equal(result.finalized, false);
  assert.equal(client.books.finalize.callCount(), 0);
});

test('createBookFromTemplate validation - empty contents', async () => {
  const client = buildMockClient();
  await assert.rejects(
    () => new HelpersClient(client).createBookFromTemplate({
      bookSpec: { uid: 'X' },
      cover: { templateUid: 'cv' },
      contents: [],
    }),
    (e) => {
      assert.ok(e instanceof SweetbookHelperError);
      assert.equal(e.stage, HelperStage.VALIDATION);
      assert.equal(e.code, HelperErrorCodes.VALIDATION);
      assert.equal(client.books.create.callCount(), 0);
      return true;
    },
  );
});

test('createBookFromTemplate validation - missing bookSpec.uid', async () => {
  await assert.rejects(
    () => new HelpersClient(buildMockClient()).createBookFromTemplate({
      bookSpec: {},
      cover: { templateUid: 'cv' },
      contents: [{ templateUid: 'p' }],
    }),
    (e) => e.stage === HelperStage.VALIDATION,
  );
});

test('createBookFromTemplate book.create failure', async () => {
  const client = buildMockClient();
  const apiErr = new SweetbookApiError('Bad', { errorCode: 'ERR_VALIDATION_FAILED', statusCode: 400 });
  client.books.create = withThrow(apiErr);

  await assert.rejects(
    () => new HelpersClient(client).createBookFromTemplate({
      bookSpec: { uid: 'X' },
      cover: { templateUid: 'cv' },
      contents: [{ templateUid: 'p' }],
    }),
    (e) => {
      assert.ok(e instanceof SweetbookHelperError);
      assert.equal(e.stage, HelperStage.BOOK_CREATE);
      assert.equal(e.code, HelperErrorCodes.BOOK_CREATE_FAILED);
      assert.equal(e.bookUid, null);
      assert.equal(e.partial.bookCreated, false);
      assert.equal(e.cause, apiErr);
      assert.equal(client.covers.create.callCount(), 0);
      return true;
    },
  );
});

test('createBookFromTemplate cover failure keeps bookUid', async () => {
  const client = buildMockClient();
  client.books.create = withReturn(null, { bookUid: 'bk_x' });
  client.covers.create = withThrow(
    new SweetbookApiError('Bad', { errorCode: 'ERR_TEMPLATE_BINDING_MISSING', statusCode: 400 }),
  );

  await assert.rejects(
    () => new HelpersClient(client).createBookFromTemplate({
      bookSpec: { uid: 'X' },
      cover: { templateUid: 'cv' },
      contents: [{ templateUid: 'p' }],
    }),
    (e) => {
      assert.equal(e.stage, HelperStage.COVER_CREATE);
      assert.equal(e.bookUid, 'bk_x');
      assert.equal(e.partial.bookCreated, true);
      assert.equal(e.partial.coverCreated, false);
      assert.equal(client.contents.insert.callCount(), 0);
      return true;
    },
  );
});

test('createBookFromTemplate content failure includes index', async () => {
  const client = buildMockClient();
  client.books.create = withReturn(null, { bookUid: 'bk_y' });
  client.covers.create = withReturn(null, {});
  let i = 0;
  client.contents.insert = mockFn(async () => {
    if (i++ === 0) return { pageNum: 2, pageSide: 'left' };
    throw new SweetbookApiError('Bad', { statusCode: 400 });
  });

  await assert.rejects(
    () => new HelpersClient(client).createBookFromTemplate({
      bookSpec: { uid: 'X' },
      cover: { templateUid: 'cv' },
      contents: [
        { templateUid: 'p1', params: {} },
        { templateUid: 'p2', params: {} },
      ],
    }),
    (e) => {
      assert.equal(e.stage, HelperStage.CONTENT_INSERT);
      assert.equal(e.contentIndex, 1);
      assert.equal(e.bookUid, 'bk_y');
      assert.equal(e.partial.contentsInserted.length, 1);
      return true;
    },
  );
});

test('createBookFromTemplate finalize failure', async () => {
  const client = buildMockClient();
  client.books.create = withReturn(null, { bookUid: 'bk_z' });
  client.covers.create = withReturn(null, {});
  client.contents.insert = withReturn(null, { pageNum: 2 });
  client.books.finalize = withThrow(
    new SweetbookApiError('Bad', { errorCode: 'ERR_FINALIZE_PREREQ_UNMET', statusCode: 400 }),
  );

  await assert.rejects(
    () => new HelpersClient(client).createBookFromTemplate({
      bookSpec: { uid: 'X' },
      cover: { templateUid: 'cv' },
      contents: [{ templateUid: 'p' }],
    }),
    (e) => {
      assert.equal(e.stage, HelperStage.BOOK_FINALIZE);
      assert.equal(e.code, HelperErrorCodes.FINALIZE_FAILED);
      assert.equal(e.partial.finalized, false);
      assert.equal(e.partial.coverCreated, true);
      return true;
    },
  );
});

// =============================================================================
// uploadPdfAndOrder
// =============================================================================

const SHIPPING = {
  recipientName: '홍길동',
  recipientPhone: '010-1234-5678',
  postalCode: '06100',
  address1: '서울 강남구',
};

test('uploadPdfAndOrder happy path', async () => {
  const client = buildMockClient({ withPdfs: true });
  client.books.create = withReturn(null, { bookUid: 'bk_pdf' });
  client.pdfs.uploadCover = withReturn(null, { size: 100 });
  client.pdfs.uploadContents = withReturn(null, { size: 200 });
  client.books.finalize = withReturn(null, {});
  client.orders.estimate = withReturn(null, { creditSufficient: true });
  client.orders.create = withReturn(null, { orderUid: 'or_test' });

  const result = await new HelpersClient(client).uploadPdfAndOrder({
    bookSpec: { uid: 'PHOTOBOOK_A4_SC', pageCount: 24 },
    pdfs: { cover: 'cover-bytes', contents: 'contents-bytes' },
    order: { shipping: SHIPPING },
  });

  assert.equal(result.bookUid, 'bk_pdf');
  assert.equal(result.orderUid, 'or_test');
  assert.equal(result.finalized, true);
  assert.ok(result.estimate);

  const createArgs = client.books.create.calls[0][0];
  assert.equal(createArgs.creationType, 'PDF_UPLOAD');
  assert.equal(createArgs.pageCount, 24);
});

test('uploadPdfAndOrder insufficient credit raises', async () => {
  const client = buildMockClient({ withPdfs: true });
  client.books.create = withReturn(null, { bookUid: 'bk_ic' });
  client.pdfs.uploadCover = withReturn(null, {});
  client.pdfs.uploadContents = withReturn(null, {});
  client.books.finalize = withReturn(null, {});
  client.orders.estimate = withReturn(null, {
    creditSufficient: false, paidCreditAmount: 50000, creditBalance: 1000,
  });

  await assert.rejects(
    () => new HelpersClient(client).uploadPdfAndOrder({
      bookSpec: { uid: 'X', pageCount: 24 },
      pdfs: { cover: 'c', contents: 'i' },
      order: { shipping: SHIPPING },
    }),
    (e) => {
      assert.equal(e.stage, HelperStage.ORDER_ESTIMATE);
      assert.equal(e.code, HelperErrorCodes.CREDIT_INSUFFICIENT);
      assert.equal(e.bookUid, 'bk_ic');
      assert.equal(client.orders.create.callCount(), 0);
      return true;
    },
  );
});

test('uploadPdfAndOrder skipEstimate proceeds directly', async () => {
  const client = buildMockClient({ withPdfs: true });
  client.books.create = withReturn(null, { bookUid: 'bk_se' });
  client.pdfs.uploadCover = withReturn(null, {});
  client.pdfs.uploadContents = withReturn(null, {});
  client.books.finalize = withReturn(null, {});
  client.orders.create = withReturn(null, { orderUid: 'or_se' });

  const result = await new HelpersClient(client).uploadPdfAndOrder({
    bookSpec: { uid: 'X', pageCount: 24 },
    pdfs: { cover: 'c', contents: 'i' },
    order: { shipping: SHIPPING },
    options: { skipEstimate: true },
  });
  assert.equal(result.estimate, null);
  assert.equal(client.orders.estimate.callCount(), 0);
  assert.equal(client.orders.create.callCount(), 1);
});

test('uploadPdfAndOrder PDF cover upload failure', async () => {
  const client = buildMockClient({ withPdfs: true });
  client.books.create = withReturn(null, { bookUid: 'bk_pf' });
  client.pdfs.uploadCover = withThrow(
    new SweetbookApiError('Bad', { errorCode: 'ERR_PDF_FILE_MISSING', statusCode: 400 }),
  );

  await assert.rejects(
    () => new HelpersClient(client).uploadPdfAndOrder({
      bookSpec: { uid: 'X', pageCount: 24 },
      pdfs: { cover: 'c', contents: 'i' },
      order: { shipping: SHIPPING },
    }),
    (e) => {
      assert.equal(e.stage, HelperStage.PDF_UPLOAD_COVER);
      assert.equal(e.code, HelperErrorCodes.PDF_UPLOAD_FAILED);
      assert.equal(e.partial.bookCreated, true);
      assert.equal(e.partial.coverPdfUploaded, false);
      assert.equal(client.pdfs.uploadContents.callCount(), 0);
      return true;
    },
  );
});

test('uploadPdfAndOrder validation - missing recipient', async () => {
  await assert.rejects(
    () => new HelpersClient(buildMockClient({ withPdfs: true })).uploadPdfAndOrder({
      bookSpec: { uid: 'X', pageCount: 24 },
      pdfs: { cover: 'c', contents: 'i' },
      order: { shipping: { address1: '서울' } },
    }),
    (e) => e.stage === HelperStage.VALIDATION,
  );
});

// =============================================================================
// SweetbookHelperError 표시 / userMessage
// =============================================================================

test('SweetbookHelperError toString includes stage and bookUid', () => {
  const e = new SweetbookHelperError('fail', {
    stage: HelperStage.CONTENT_INSERT,
    code: HelperErrorCodes.CONTENT_INSERT_FAILED,
    bookUid: 'bk_xyz',
    contentIndex: 3,
  });
  const s = e.toString();
  assert.match(s, /CONTENT_INSERT#3/);
  assert.match(s, /bk_xyz/);
});

test('SweetbookHelperError userMessage delegates to ApiError cause', () => {
  const api = new SweetbookApiError('Bad', {
    statusCode: 400, details: ['사용자에게 보여줄 한글 메시지'],
  });
  const e = new SweetbookHelperError('fail', {
    stage: HelperStage.BOOK_CREATE, code: HelperErrorCodes.BOOK_CREATE_FAILED, cause: api,
  });
  assert.equal(e.userMessage(), '사용자에게 보여줄 한글 메시지');
});

test('SweetbookHelperError userMessage fallback', () => {
  const e = new SweetbookHelperError('fallback msg', {
    stage: HelperStage.VALIDATION, code: HelperErrorCodes.VALIDATION,
  });
  assert.equal(e.userMessage(), 'fallback msg');
});
