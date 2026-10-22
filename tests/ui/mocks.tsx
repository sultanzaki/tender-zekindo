import { createElement, type ComponentProps } from "react";
export function Link(props: ComponentProps<"a">) {
  return <a {...props} />;
}
export function Image({
  priority: _priority,
  ...props
}: ComponentProps<"img"> & { priority?: boolean }) {
  void _priority;
  return createElement("img", { ...props, alt: props.alt ?? "" });
}
export function usePathname() {
  return "/tenders";
}
export function useSearchParams() {
  return new URLSearchParams(location.search);
}
export function useRouter() {
  return {
    push(path: string) {
      document.body.dataset.pushed = path;
    },
    refresh() {
      document.body.dataset.refreshed = "true";
    },
  };
}
export async function logout() {}
export async function createTender() {
  return { error: "Test save blocked" };
}
export async function updateTender(_id: string, values: unknown) {
  document.body.dataset.saved = JSON.stringify(values);
  return { error: "Test save blocked" };
}
export async function archiveTender() {
  return {};
}
export async function ensureMilestoneTypeByName() {
  return { key: "new", error: undefined };
}
export async function setTenderMilestoneOrder() {
  return {};
}
export async function addSelectOption() {
  return { value: "New area" };
}
export async function createUser() {
  return {};
}
export async function removeUser() {
  return { error: "Could not remove user" };
}
export async function updateUserRole() {
  return { error: "Could not update role" };
}
export async function resetUserPassword() {
  return {};
}
export async function bulkArchiveTenders() {
  return { error: "Could not archive tenders" };
}
export async function bulkDeleteTenders() {
  return { error: "Could not delete tenders" };
}
export async function quickUpdateMilestone() {
  return {};
}
export async function quickUpdateResult() {
  return {};
}
export async function createDocumentFolder() {
  return {};
}
export async function deleteDocumentFolder() {
  return {};
}
export async function deleteTenderFile() {
  return {};
}
export async function renameDocumentFolder() {
  return {};
}
export async function prepareFileUpload(
  tenderId: string,
  _target: unknown,
  files: { name: string; size: number; type: string }[],
) {
  void _target;
  if (!location.search.includes("upload=success"))
    throw new Error("Simulated connection failure");
  return {
    uploads: files.map((file, index) => ({
      index,
      path: `${tenderId}/${index}-${file.name}`,
      signedUrl: `${location.origin}/fixture-storage`,
      fileName: file.name,
      contentType: file.type,
    })),
  };
}
export async function completeFileUpload(
  _id: string,
  _target: unknown,
  uploaded: unknown,
) {
  void _id;
  void _target;
  document.body.dataset.uploaded = JSON.stringify(uploaded);
  return {};
}

export async function cancelPreparedUploads() {
  return {};
}
export async function restoreTender() {
  return { error: "Restore failed" };
}
export async function deleteTenderPermanently() {
  return { error: "Delete failed" };
}
export async function addMilestoneType() {
  return {};
}
export async function archiveMilestoneType() {
  return {};
}
export async function moveMilestoneType() {
  return {};
}
export async function renameMilestoneType() {
  return {};
}
export async function restoreMilestoneType() {
  return {};
}
export async function setMilestoneTableVisibility() {
  return {};
}

export async function login() {
  return { error: "Incorrect email or password." };
}
