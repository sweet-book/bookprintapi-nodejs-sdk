/**
 * books.create() 의 pageCount 검증 동작.
 *
 * PDF_UPLOAD / MIX_COVER_TEMPLATE 시 필수, TEMPLATE 시 선택.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { BooksClient } = require('../lib/client');
const { SweetbookValidationError } = require('../lib/core');


/** http 호출을 가로채서 payload 만 캡쳐하는 가짜 클라이언트. */
function makeFake() {
  const calls = [];
  const fake = {
    _post: async (path, payload) => {
      calls.push({ path, payload });
      return { success: true, data: { bookUid: 'B-1', pageMeta: {} } };
    },
  };
  const books = Object.assign(Object.create(BooksClient.prototype), fake);
  return { books, calls };
}


test('TEMPLATE 모드: pageCount 없이 호출 정상', async () => {
  const { books, calls } = makeFake();
  await books.create({ bookSpecUid: 'SQUAREBOOK_HC', title: 't' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/books');
  assert.deepEqual(calls[0].payload, {
    bookSpecUid: 'SQUAREBOOK_HC',
    creationType: 'TEMPLATE',
    title: 't',
  });
  assert.equal('pageCount' in calls[0].payload, false);
});


test('TEMPLATE 모드: pageCount 전달 시 payload 에 포함 (서버가 무시)', async () => {
  const { books, calls } = makeFake();
  await books.create({ bookSpecUid: 'SQUAREBOOK_HC', pageCount: 24 });
  assert.equal(calls[0].payload.pageCount, 24);
});


test('PDF_UPLOAD: pageCount 없으면 ValidationError', async () => {
  const { books } = makeFake();
  await assert.rejects(
    () => books.create({ bookSpecUid: 'SQUAREBOOK_HC', creationType: 'PDF_UPLOAD' }),
    (err) => err instanceof SweetbookValidationError && err.field === 'pageCount',
  );
});


test('PDF_UPLOAD: pageCount=0 거부', async () => {
  const { books } = makeFake();
  await assert.rejects(
    () => books.create({ bookSpecUid: 'SQUAREBOOK_HC', creationType: 'PDF_UPLOAD', pageCount: 0 }),
    (err) => err instanceof SweetbookValidationError,
  );
});


test('PDF_UPLOAD: pageCount=-1 거부', async () => {
  const { books } = makeFake();
  await assert.rejects(
    () => books.create({ bookSpecUid: 'SQUAREBOOK_HC', creationType: 'PDF_UPLOAD', pageCount: -1 }),
    (err) => err instanceof SweetbookValidationError,
  );
});


test('PDF_UPLOAD: pageCount=24 정상', async () => {
  const { books, calls } = makeFake();
  await books.create({ bookSpecUid: 'SQUAREBOOK_HC', creationType: 'PDF_UPLOAD', pageCount: 24 });
  assert.deepEqual(calls[0].payload, {
    bookSpecUid: 'SQUAREBOOK_HC',
    creationType: 'PDF_UPLOAD',
    pageCount: 24,
  });
});


test('MIX_COVER_TEMPLATE: pageCount 없으면 ValidationError', async () => {
  const { books } = makeFake();
  await assert.rejects(
    () => books.create({ bookSpecUid: 'SQUAREBOOK_HC', creationType: 'MIX_COVER_TEMPLATE' }),
    (err) => err instanceof SweetbookValidationError && err.field === 'pageCount',
  );
});


test('MIX_COVER_TEMPLATE: pageCount + externalRef 함께 정상 전송', async () => {
  const { books, calls } = makeFake();
  await books.create({
    bookSpecUid: 'SQUAREBOOK_HC',
    creationType: 'MIX_COVER_TEMPLATE',
    pageCount: 12,
    externalRef: 'ext-1',
  });
  assert.deepEqual(calls[0].payload, {
    bookSpecUid: 'SQUAREBOOK_HC',
    creationType: 'MIX_COVER_TEMPLATE',
    pageCount: 12,
    externalRef: 'ext-1',
  });
});
