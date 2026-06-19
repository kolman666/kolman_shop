// Injects a JSON-LD <script> for SEO rich snippets (Google shows price, ★
// rating, availability right in the search results).
//
// We escape `<` to its unicode form so a stray `</script>` inside any string
// field can't break out of the <script> element. Field values here are
// admin-controlled, so this is defence-in-depth rather than a live XSS fix.

type JsonLdProps = {
  data: Record<string, unknown>
}

export default function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
