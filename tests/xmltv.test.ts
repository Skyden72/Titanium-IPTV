import { describe, expect, it } from 'vitest';
import { parseXmltv, parseXmltvDate } from '../src/services/xmltv';

describe('parseXmltvDate', () => {
  it('parses Zulu timestamps', () => {
    expect(parseXmltvDate('20240101120000 Z')).toBe(Date.UTC(2024, 0, 1, 12, 0, 0));
  });

  it('parses positive offset timestamps', () => {
    const timestamp = parseXmltvDate('20240101120000 +0530');
    const expected = Date.UTC(2024, 0, 1, 6, 30, 0);
    expect(timestamp).toBe(expected);
  });

  it('parses negative offset timestamps', () => {
    const timestamp = parseXmltvDate('20240101120000 -0700');
    const expected = Date.UTC(2024, 0, 1, 19, 0, 0);
    expect(timestamp).toBe(expected);
  });

  it('returns NaN for invalid input', () => {
    expect(Number.isNaN(parseXmltvDate('invalid'))).toBe(true);
  });
});

describe('parseXmltv', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <tv>
    <programme start="20240101060000 +0000" stop="20240101070000 +0000" channel="news">
      <title>Morning News</title>
      <desc>Latest updates</desc>
    </programme>
    <programme start="20240101050000 +0000" stop="20240101053000 +0000" channel="news">
      <title>Weather</title>
    </programme>
    <programme start="20240101080000 +0000" stop="20240101083000 +0000" channel="sports">
      <title>Highlights</title>
      <desc></desc>
    </programme>
    <programme start="invalid" stop="20240101090000 +0000" channel="sports">
      <title>Ignored</title>
    </programme>
  </tv>`;

  it('groups programmes by channel and sorts by start time', () => {
    const result = parseXmltv(xml);
    expect(Object.keys(result)).toEqual(['news', 'sports']);
    expect(result.news.map((program) => program.title)).toEqual(['Weather', 'Morning News']);
    expect(result.sports[0]).toMatchObject({
      title: 'Highlights',
      description: undefined,
    });
  });

  it('memoizes results for identical xml inputs', () => {
    const first = parseXmltv(xml);
    const second = parseXmltv(xml);
    expect(first).toBe(second);
  });
});
