const enrichItemHtml = async (
  document: FoundryItem,
  content: string | undefined,
): Promise<string> => foundry.applications.ux.TextEditor.implementation.enrichHTML(
  content ?? '',
  {
    relativeTo: document,
    secrets: document.isOwner,
  },
);

export { enrichItemHtml };
