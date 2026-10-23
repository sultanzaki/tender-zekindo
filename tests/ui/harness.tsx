import { LoginForm } from "../../src/components/LoginForm";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TopNav } from "../../src/components/TopNav";
import { TenderTableClient } from "../../src/components/TenderTableClient";
import { EditTenderForm } from "../../src/components/EditTenderForm";
import { ArchiveAction } from "../../src/components/ArchiveAction";
import { DeadlineWorkspace } from "../../src/components/DeadlineWorkspace";
import { MilestoneAdmin } from "../../src/components/MilestoneAdmin";
import { NewTenderForm } from "../../src/components/NewTenderForm";
import { ManageUsersClient } from "../../src/components/ManageUsersClient";
import { NumberInput } from "../../src/components/NumberInput";
import { DocumentExplorer } from "../../src/components/DocumentExplorer";
import { MoneyValue } from "../../src/components/MoneyValue";
import { KpiCards } from "../../src/components/charts/KpiCards";
import { TrackComparisonChart } from "../../src/components/charts/TrackComparisonChart";
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
function FinancialDemo({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <div data-testid="money-field">
        <MoneyValue value={1234567.89} canView={signedIn} />
      </div>
      <KpiCards
        canViewMoney={signedIn}
        data={{
          pipelineValue: 1234567.89,
          winValue: 987654.32,
          runningCount: 12,
          winRatePct: 60,
          winCount: 6,
          lossCount: 4,
          decidedCount: 10,
        }}
      />
      <TrackComparisonChart
        canViewMoney={signedIn}
        data={[
          {
            track: "upstream",
            label: "Upstream",
            count: 12,
            pipelineValue: 1234567.89,
            winValue: 987654.32,
            winRate: 60,
          },
        ]}
      />
      <TenderTableClient
        tenders={[
          {
            ...tenders[0],
            oe: signedIn ? 1234567.89 : null,
            nilaiPenawaran: signedIn ? 987654.32 : null,
            qty: 12.5,
          },
        ]}
        options={{
          periods: ["2026"],
          areas: ["Jawa"],
          entitasList: ["ZKI"],
          customers: ["Customer"],
        }}
        milestoneTypes={[]}
        anchor="2026-10-22"
        isAdmin={false}
        canViewMoney={signedIn}
        track="upstream"
      />
    </>
  );
}
const components = {
  "guest-money": <FinancialDemo signedIn={false} />,
  "viewer-money": <FinancialDemo signedIn />,
  nav: (
    <>
      <TopNav profile={user}>
        <div style={{ height: 400 }}>Page content</div>
      </TopNav>
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
      canViewMoney
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
  edit: (
    <EditTenderForm
      tender={
        {
          ...tenders[0],
          qty: 12.5,
          oe: 1000,
          nilaiPenawaran: 900,
          oeCatatan: null,
          catatanInternal: null,
        } as Tender
      }
      selectOptions={{
        area: ["Jawa"],
        customer: ["Customer"],
        entitas: ["ZKI"],
      }}
      milestoneTypes={[
        {
          id: "m1",
          key: "m1",
          label: "Site visit",
          track: "upstream",
          sortOrder: 1,
          showInTable: true,
        },
      ]}
      existingTenders={[]}
    />
  ),
  archive: <ArchiveAction tenderId="t" action="delete" />,
  deadlines: (
    <DeadlineWorkspace
      deadlines={[
        {
          tenderId: "t",
          days: 2,
          daysLabel: "D-2",
          customer: "Customer",
          product: "Package",
          milestoneLabel: "Site visit",
          dateFormatted: "24 Oct 2026",
          dateIso: "2026-10-24",
          milestoneKey: "m1",
          urgent: true,
          track: "upstream",
        },
      ]}
      followups={[]}
    />
  ),
  milestones: (
    <MilestoneAdmin
      sections={[
        { track: "upstream", loadError: null, milestoneTypes: [] },
        { track: "downstream", loadError: null, milestoneTypes: [] },
      ]}
    />
  ),
  login: <LoginForm next="/" />,
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
const name = (new URLSearchParams(location.search).get("component") ||
  "table") as keyof typeof components;
createRoot(document.getElementById("root")!).render(components[name]);
