import { describe, expect, it } from 'vitest';

import { formatMoneyInput, moneyCaret, parseMoneyInput } from './money-format';

interface CaretCase {
  cursor: number;
  expected: number;
  formatted: string;
  name: string;
  previous: string;
}

interface FormatCase {
  expected: string;
  name: string;
  value: string;
}

interface ParseCase {
  expected: string;
  name: string;
  value: string;
}

const FORMAT_CASES: FormatCase[] = [
  { expected: '', name: 'keeps an empty field empty', value: '' },
  { expected: '0', name: 'keeps zero', value: '0' },
  { expected: '12', name: 'leaves a short number alone', value: '12' },
  { expected: '1 234', name: 'groups four digits', value: '1234' },
  { expected: '1 000 000', name: 'groups a million', value: '1000000' },
  { expected: '1 000 000', name: 'keeps spaces already in the field', value: '1 000 000' },
  { expected: '1 000.5', name: 'groups digits and keeps cents', value: '1000.5' },
  { expected: '1 000.50', name: 'keeps two decimal places', value: '1000.50' },
  { expected: '1 000.56', name: 'drops digits past cents', value: '1000.567' },
  { expected: '0.5', name: 'keeps a leading decimal point', value: '.5' },
  { expected: '1 000.', name: 'keeps a trailing decimal point', value: '1000.' },
  { expected: '1 234', name: 'drops letters', value: '12a34' },
  { expected: '1 000.5', name: 'treats a single comma as cents', value: '1000,5' },
  { expected: '1 000 000', name: 'drops commas between thousands', value: '1,000,000' },
];

const PARSE_CASES: ParseCase[] = [
  { expected: '0', name: 'treats an empty field as zero', value: '' },
  { expected: '1000000', name: 'removes grouping spaces', value: '1 000 000' },
  { expected: '1000.5', name: 'keeps a decimal value', value: '1 000.5' },
  { expected: '1000', name: 'drops a trailing decimal point', value: '1 000.' },
  { expected: '0.5', name: 'keeps cents without a whole part', value: '.5' },
  { expected: '1000.50', name: 'reads a comma as the decimal mark', value: '1 000,50' },
];

const CARET_CASES: CaretCase[] = [
  {
    cursor: 4,
    expected: 5,
    formatted: '1 000',
    name: 'moves past the inserted space at the end',
    previous: '1000',
  },
  {
    cursor: 1,
    expected: 1,
    formatted: '1 000 000',
    name: 'stays after the first digit',
    previous: '1000000',
  },
  {
    cursor: 4,
    expected: 5,
    formatted: '1 000 000',
    name: 'stays after the fourth digit',
    previous: '1000000',
  },
];

describe('formatMoneyInput', () => {
  it.each(FORMAT_CASES)('$name', ({ expected, value }) => {
    expect(formatMoneyInput(value)).toBe(expected);
  });
});

describe('parseMoneyInput', () => {
  it.each(PARSE_CASES)('$name', ({ expected, value }) => {
    expect(parseMoneyInput(value)).toBe(expected);
  });
});

describe('moneyCaret', () => {
  it.each(CARET_CASES)('$name', ({ cursor, expected, formatted, previous }) => {
    expect(moneyCaret(previous, formatted, cursor)).toBe(expected);
  });
});
