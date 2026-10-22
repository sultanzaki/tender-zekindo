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
    push() {},
    refresh() {
      document.body.dataset.refreshed = "true";
    },
  };
}
export async function logout() {}
export async function createTender() {
  return { error: "Test save blocked" };
}
export async function updateTender() {
  return {};
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
export async function prepareFileUpload() {
  throw new Error("Simulated connection failure");
}
export async function completeFileUpload() {
  return {};
}
