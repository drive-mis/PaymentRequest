"use client";

import { useState } from "react";
import { Guard } from "@/components/Guard";
import { useStore } from "@/lib/store";
import { ROLES, type Role, type User } from "@/lib/types";

const BLANK: User = { name: "", role: "Sales", title: "", active: true };

export default function AdminUsersPage() {
  return (
    <Guard allow={["Admin"]}>
      {() => <UsersManager />}
    </Guard>
  );
}

function UsersManager() {
  const { users, addUser, updateUser, removeUser, allRequests, allAssignments } = useStore();
  const [draft, setDraft] = useState<User>(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(fn: () => void, successMessage: string) {
    setError(null);
    setNotice(null);
    try {
      fn();
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function submit() {
    if (editing) {
      run(() => {
        updateUser(editing, draft);
        setEditing(null);
        setDraft(BLANK);
      }, `Updated ${draft.name}.`);
    } else {
      run(() => {
        addUser(draft);
        setDraft(BLANK);
      }, `Added ${draft.name}.`);
    }
  }

  function workloadFor(name: string) {
    const reqs = allRequests.filter((r) => r.CreatedBy === name || r.DRV_SALES_MAN === name).length;
    const asg = allAssignments.filter((a) => a.DRV_SALES_MAN === name && !a.ConsumedByAppId).length;
    return { reqs, asg };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Users</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage who can sign in and what role they hold. Sales agents&apos; names are what uploaded applications are
          matched against, so they must match your spreadsheet exactly.
        </p>
      </div>

      {error && <div className="card p-3 border-status-red bg-red-50 text-sm text-status-red">{error}</div>}
      {notice && <div className="card p-3 border-emerald-300 bg-emerald-50 text-sm text-emerald-800">{notice}</div>}

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-df-text">{editing ? `Edit ${editing}` : "Add a user"}</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="field-label">Full Name</label>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Mona Aziz"
            />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select
              className="input"
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as Role }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Job Title</label>
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Sales Agent"
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select
              className="input"
              value={draft.active ? "Active" : "Inactive"}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.value === "Active" }))}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={submit} disabled={!draft.name.trim()}>
            {editing ? "Save Changes" : "Add User"}
          </button>
          {editing && (
            <button
              className="btn-secondary"
              onClick={() => {
                setEditing(null);
                setDraft(BLANK);
                setError(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-zebra">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-2.5">Name</th>
                <th className="text-left px-5 py-2.5">Role</th>
                <th className="text-left px-5 py-2.5">Title</th>
                <th className="text-left px-5 py-2.5">Status</th>
                <th className="text-left px-5 py-2.5">Workload</th>
                <th className="text-left px-5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const { reqs, asg } = workloadFor(u.name);
                return (
                  <tr key={u.name} className="hover:bg-df-indigo/5">
                    <td className="px-5 py-2.5 font-medium text-df-text">{u.name}</td>
                    <td className="px-5 py-2.5">{u.role}</td>
                    <td className="px-5 py-2.5 text-slate-500">{u.title || "—"}</td>
                    <td className="px-5 py-2.5">
                      <span className={`badge ${u.active ? "badge-green" : "badge-slate"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">
                      {reqs} request{reqs === 1 ? "" : "s"}
                      {u.role === "Sales" && `, ${asg} open`}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex gap-2">
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs"
                          onClick={() => {
                            setEditing(u.name);
                            setDraft(u);
                            setError(null);
                            setNotice(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost !px-2 !py-1 text-xs !text-status-red"
                          onClick={() => run(() => removeUser(u.name), `Deleted ${u.name}.`)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        A user who already owns requests or open assignments cannot be deleted — set them to Inactive instead, which
        blocks sign-in while keeping their history intact.
      </p>
    </div>
  );
}
