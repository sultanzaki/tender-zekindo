import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TopNav } from "../../src/components/TopNav";
import { TenderTableClient } from "../../src/components/TenderTableClient";
import { NewTenderForm } from "../../src/components/NewTenderForm";
import { ManageUsersClient } from "../../src/components/ManageUsersClient";
import { NumberInput } from "../../src/components/NumberInput";
import { DocumentExplorer } from "../../src/components/DocumentExplorer";
import type { Tender, Profile } from "../../src/lib/types";
import "../../src/app/globals.css";
const user: Profile = {
  id: "admin",
  name: "Test Admin",
  email: "admin@example.test",
  role: "admin",
  createdAt: "",
};
const tenders = Array.from(
  { length: 120 },
  (_, i) =>
    ({
      id: String(i),
      rowNo: i + 1,
      track: "upstream",
      period: "2026",
      area: "Jawa",
      tenderNo: `TN-${i + 1}`,
      customer: "Customer",
      product: `Package ${i + 1}`,
      entitas: "ZKI",
      milestones: {},
      milestoneOrder: null,
      result: null,
      pnl: false,
      archivedAt: null,
    }) as Tender,
);
function NumberDemo() {
  const [value, setValue] = useState("123.45");
  return (
    <label>
      Amount
      <NumberInput value={value} onChange={setValue} />
      <output>{value}</output>
    </label>
  );
}
const components = {
  nav: (
    <>
      <TopNav profile={user} />
      <main style={{ height: 400 }}>Page content</main>
    </>
  ),
  table: (
    <TenderTableClient
      tenders={tenders}
      options={{
        periods: ["2026"],
        areas: ["Jawa"],
        entitasList: ["ZKI"],
        customers: ["Customer"],
      }}
      milestoneTypes={[]}
      anchor="2026-10-22"
      isAdmin
      track="upstream"
    />
  ),
  wizard: (
    <NewTenderForm
      initialTrack="upstream"
      selectOptions={{
        area: ["Jawa"],
        customer: ["Customer"],
        entitas: ["ZKI"],
      }}
      catalogs={{ upstream: [], downstream: [] }}
      existingTenders={[]}
    />
  ),
  users: (
    <ManageUsersClient
      users={[
        user,
        { ...user, id: "viewer", name: "Test Viewer", role: "viewer" },
      ]}
      currentUserId="admin"
    />
  ),
  number: <NumberDemo />,
  documents: (
    <DocumentExplorer
      tenderId="test"
      sections={[
        {
          id: "m1",
          title: "Site Visit",
          kind: "milestone",
          milestoneKey: "m1",
          documentTypeId: null,
          rootFiles: [],
          folders: [],
        },
      ]}
      isAdmin
    />
  ),
};
const name = new URLSearchParams(location.search).get(
  "component",
) as keyof typeof components;
createRoot(document.getElementById("root")!).render(components[name]);
