// Shared between TemplateStudioPage (reads) and TemplateIrisPage (invalidates
// after Iris executes create_template/edit_template) so both never drift on
// what a "templates for this WABA" query key looks like.
export const templateQueryKeys = {
  list: (wabaId: string) => ['templates', wabaId] as const,
}
