export const getDateJa = (date: Date) => {
  const d = new Date(date)
  return d.toLocaleDateString()
}

export const getKeywordsArray = (keywords: string) => {
  return keywords.split(',')
}
