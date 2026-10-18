export const openingHoursDefault = () =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: day === 5 || day === 6 ? '23:00' : '22:00', closed: false }));
