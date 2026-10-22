export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 50;
export function validUploadPath(tenderId: string, path: string) {
  return (
    path.startsWith(`${tenderId}/`) &&
    !path.includes("..") &&
    !path.includes("\\") &&
    path.split("/").length === 2
  );
}

export function validFileSection(
  milestoneKey: string | null,
  documentTypeId: string | null,
): boolean {
  if (Boolean(milestoneKey) === Boolean(documentTypeId)) return false;
  return milestoneKey
    ? /^[a-zA-Z0-9][a-zA-Z0-9_]*$/.test(milestoneKey)
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        documentTypeId || "",
      );
}
