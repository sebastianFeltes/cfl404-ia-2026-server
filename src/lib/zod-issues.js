export function zodIssueList(error) {
  const raw = Array.isArray(error?.issues)
    ? error.issues
    : Array.isArray(error?.errors)
      ? error.errors
      : []

  return raw.map((issue) => ({
    field: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
    message: issue.message || 'Dato inválido',
  }))
}
