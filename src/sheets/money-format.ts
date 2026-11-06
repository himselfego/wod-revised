import filter from 'lodash/filter';
import includes from 'lodash/includes';
import join from 'lodash/join';
import replace from 'lodash/replace';
import split from 'lodash/split';

const FRACTION_DIGITS = 2;
const GROUP_SIZE = 3;

interface MoneyDraft {
  fraction: string | undefined;
  whole: string;
}

const isMoneyChar = (symbol: string): boolean => symbol === '.' || (symbol >= '0' && symbol <= '9');

const decimalMarked = (value: string): string => {
  const parts = split(value, ',');

  if (parts.length !== 2 || includes(value, '.')) {
    return value;
  }

  return join(parts, '.');
};

const moneyDraft = (value: string): MoneyDraft => {
  const cleaned = replace(decimalMarked(value), /[^\d.]/g, '');
  const [whole = '', ...rest] = split(cleaned, '.');

  if (rest.length === 0) {
    return { fraction: undefined, whole };
  }

  return {
    fraction: join(rest, '').slice(0, FRACTION_DIGITS),
    whole,
  };
};

const groupDigits = (digits: string): string => {
  if (digits.length <= GROUP_SIZE) {
    return digits;
  }

  const lead = digits.length % GROUP_SIZE;
  const width = lead === 0 ? GROUP_SIZE : lead;
  const groups = [digits.slice(0, width)];
  let index = width;

  while (index < digits.length) {
    groups.push(digits.slice(index, index + GROUP_SIZE));
    index += GROUP_SIZE;
  }

  return join(groups, ' ');
};

const formatMoneyInput = (value: string): string => {
  const { fraction, whole } = moneyDraft(value);

  if (whole === '' && fraction === undefined) {
    return '';
  }

  const grouped = groupDigits(whole === '' ? '0' : whole);

  if (fraction === undefined) {
    return grouped;
  }

  return `${grouped}.${fraction}`;
};

const parseMoneyInput = (value: string): string => {
  const { fraction, whole } = moneyDraft(value);

  if (fraction === undefined || fraction === '') {
    return whole === '' ? '0' : whole;
  }

  const digits = whole === '' ? '0' : whole;

  return `${digits}.${fraction}`;
};

const significantCount = (value: string, cursor: number): number => {
  const head = value.slice(0, Math.max(cursor, 0));

  return filter(split(head, ''), isMoneyChar).length;
};

const moneyCaret = (previous: string, formatted: string, cursor: number): number => {
  let left = significantCount(previous, cursor);
  let index = 0;

  while (index < formatted.length && left > 0) {
    const symbol = formatted.charAt(index);

    index += 1;

    if (isMoneyChar(symbol)) {
      left -= 1;
    }
  }

  return index;
};

export {
  formatMoneyInput,
  moneyCaret,
  parseMoneyInput,
};
