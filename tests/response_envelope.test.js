/**
 * ResponseParser.toListResult — 신·구 envelope 호환성 검증.
 *
 * photobook-api commit 6fbf346 (2026-05-11) 전후 둘 다에서 동일 결과를 반환하는지 보증.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ResponseParser } = require('../lib/core');

// =============================================================================
// 신 envelope ({ data: [...], pagination: {...} })
// =============================================================================

test('신 envelope: books list 평탄화', () => {
  const raw = {
    success: true,
    message: '성공',
    data: [{ bookUid: 'b1' }, { bookUid: 'b2' }],
    pagination: { total: 2, limit: 20, offset: 0, hasNext: false },
  };
  const out = new ResponseParser(raw).toListResult('books');
  assert.deepEqual(out.books, [{ bookUid: 'b1' }, { bookUid: 'b2' }]);
  assert.deepEqual(out.pagination, { total: 2, limit: 20, offset: 0, hasNext: false });
});

test('신 envelope: pagination 없는 list', () => {
  const raw = { success: true, data: [{ key: 'a' }, { key: 'b' }] };
  const out = new ResponseParser(raw).toListResult('categories');
  assert.deepEqual(out.categories, [{ key: 'a' }, { key: 'b' }]);
  assert.equal(out.pagination, undefined);
});

// =============================================================================
// 구 envelope ({ data: { books|orders|items|...: [...], pagination } })
// =============================================================================

test('구 envelope: books 키 중첩', () => {
  const raw = {
    success: true,
    data: {
      books: [{ bookUid: 'b1' }],
      pagination: { total: 1, limit: 20, offset: 0, hasNext: false },
    },
  };
  const out = new ResponseParser(raw).toListResult('books');
  assert.deepEqual(out.books, [{ bookUid: 'b1' }]);
  assert.equal(out.pagination.total, 1);
});

test('구 envelope: items 키 중첩 (contacts/spec-profiles)', () => {
  const raw = {
    success: true,
    data: {
      items: [{ id: 1 }, { id: 2 }],
      pagination: { total: 2, limit: 10, offset: 0, hasNext: false },
    },
  };
  const out = new ResponseParser(raw).toListResult('items');
  assert.deepEqual(out.items, [{ id: 1 }, { id: 2 }]);
  assert.equal(out.pagination.total, 2);
});

test('구 envelope: photos totalCount → pagination.total', () => {
  const raw = {
    success: true,
    data: {
      photos: [{ fileName: 'a.jpg' }, { fileName: 'b.jpg' }],
      totalCount: 2,
    },
  };
  const out = new ResponseParser(raw).toListResult('photos');
  assert.deepEqual(out.photos, [{ fileName: 'a.jpg' }, { fileName: 'b.jpg' }]);
  assert.equal(out.pagination.total, 2);
});

test('구 envelope: 확장된 키들 (accounts/keys/configs 등) 자동 인식', () => {
  const cases = ['accounts', 'keys', 'memos', 'configs', 'notifications', 'transactions'];
  for (const key of cases) {
    const raw = { success: true, data: { [key]: [{ x: 1 }] } };
    const out = new ResponseParser(raw).toListResult(key);
    assert.deepEqual(out[key], [{ x: 1 }], `key=${key} 매칭 실패`);
  }
});

// =============================================================================
// 엣지 케이스
// =============================================================================

test('빈 배열', () => {
  const raw = { success: true, data: [], pagination: { total: 0, limit: 20, offset: 0, hasNext: false } };
  const out = new ResponseParser(raw).toListResult('books');
  assert.deepEqual(out.books, []);
  assert.equal(out.pagination.total, 0);
});

test('data 누락 — 빈 배열 반환', () => {
  const raw = { success: true };
  const out = new ResponseParser(raw).toListResult('books');
  assert.deepEqual(out.books, []);
  assert.equal(out.pagination, undefined);
});
