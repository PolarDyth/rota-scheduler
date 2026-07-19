import type { StoreHours } from '../types';

const WEEKDAY: StoreHours = { open: 8.5, close: 20.5 };
const SATURDAY: StoreHours = { open: 8, close: 20 };
const SUNDAY: StoreHours = { open: 8.5, close: 19 };

export function storeHoursForDay(dayName?: string): StoreHours {
  const d = dayName?.toLowerCase().trim();
  if (d === 'saturday' || d === 'sat') return SATURDAY;
  if (d === 'sunday' || d === 'sun') return SUNDAY;
  return WEEKDAY;
}

export function isOpenSlot(slotMin: number, hours: StoreHours): boolean {
  return slotMin >= hours.open * 60 && slotMin < hours.close * 60;
}

export function isOpenHour(hour: number, hours: StoreHours): boolean {
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  const openMin = hours.open * 60;
  const closeMin = hours.close * 60;
  return hStart < closeMin && hEnd > openMin;
}
