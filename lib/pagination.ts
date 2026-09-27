export function pageNumbers(page: number, pages: number) {
  return [...new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2])]
    .filter((number) => number >= 1 && number <= pages)
    .sort((a, b) => a - b);
}
