export const __ = (input: string, ...args: (string | number)[]): string => {
  return input;
};

export const __n = (
  singular: string,
  plural: string,
  count: number,
  ...args: (string | number)[]
): string => {
  return singular;
};
