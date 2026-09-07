/** Solo el boolean true cuenta como aceptación. Strings como "false" no. */
export function parseAcceptedTerms(value) {
  if (value === undefined) return undefined
  if (value === true) return true
  if (value === false) return false
  return undefined
}
