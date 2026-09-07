export function parsePagination(query = {}, { defaultTake = 50, maxTake = 100 } = {}) {
  const rawLimit = Number.parseInt(query.limit ?? query.take, 10)
  const rawPage = Number.parseInt(query.page, 10)
  const take = Math.min(maxTake, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaultTake))
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1)
  const skip = (page - 1) * take
  return { take, skip, page }
}
