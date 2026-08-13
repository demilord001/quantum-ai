const searchSignals = [
  "latest",
  "today",
  "current",
  "recent",
  "news",
  "this week",
  "this month",
  "yesterday",
  "price",
  "trending",
  "new",
  "who won",
  "what happened",
];

export function shouldSearch(
  input: string
) {
  const text = input.toLowerCase();

  return searchSignals.some(
    (signal) =>
      text.includes(signal)
  );
}