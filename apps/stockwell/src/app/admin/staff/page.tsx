'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import { useUser } from '@/components/UserContext';

export default function StaffPage() {
  const { statusBadge, Avatar, Modal, Dropdown, MenuItem, EmptyState, useToast } = UI;
  const { user, isAdmin } = useUser();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });

  const load = () => jget('/api/users').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    try {
      await jsend('/api/users', 'POST', form);
      toast({ message: `Added ${form.name}`, icon: 'check' });
      setAddOpen(false);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };
  const setRole = async (id: string, role: string) => {
    try {
      await jsend(`/api/users/${id}`, 'PUT', { role });
      load();
      toast({ message: 'Role updated', icon: 'check' });
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };
  const toggleActive = async (u: any) => {
    try {
      await jsend(`/api/users/${u.id}`, 'PUT', { active: u.active ? 0 : 1 });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };
  const del = async (id: string) => {
    try {
      await jsend(`/api/users/${id}`, 'DELETE');
      load();
      toast({ message: 'User removed', icon: 'trash', type: 'danger' });
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Staff &amp; roles</div>
          <div className="ph-sub">
            {rows.length} members · {rows.filter((r) => r.role === 'admin').length} admins
          </div>
        </div>
        <div className="ph-actions">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={14} /> Add member
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="auth-hint" style={{ marginBottom: 16 }}>
          <Icon name="info" size={13} /> You have <strong>staff</strong> access — only admins can
          add members or change roles.
        </div>
      )}

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} size={30} />
                      <div style={{ fontWeight: 500 }}>
                        {u.name}
                        {u.id === user?.id ? <span className="muted tiny"> (you)</span> : ''}
                      </div>
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 'var(--t-sm)' }}>
                    {u.email}
                  </td>
                  <td>{statusBadge(u.role)}</td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-success">
                        <span className="badge-dot" />
                        Active
                      </span>
                    ) : (
                      <span className="badge">
                        <span className="badge-dot" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <Dropdown
                        trigger={
                          <button className="icon-btn" style={{ width: 26, height: 26 }}>
                            <Icon name="more" size={14} />
                          </button>
                        }
                      >
                        <MenuItem
                          icon="user"
                          label={u.role === 'admin' ? 'Make staff' : 'Make admin'}
                          onClick={() => setRole(u.id, u.role === 'admin' ? 'staff' : 'admin')}
                        />
                        <MenuItem
                          icon={u.active ? 'lock' : 'check'}
                          label={u.active ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleActive(u)}
                        />
                        {u.id !== user?.id && <UI.MenuSep />}
                        {u.id !== user?.id && (
                          <MenuItem icon="trash" label="Remove" danger onClick={() => del(u.id)} />
                        )}
                      </Dropdown>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon="users" title="No members" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)}>
        <div
          style={{
            padding: 'var(--s-4) var(--s-5)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>Add team member</h3>
          <button
            className="icon-btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => setAddOpen(false)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: 'var(--s-5)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field">
            <span>Full name</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input
              className="input"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <div
          style={{
            padding: 'var(--s-3) var(--s-5)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            background: 'var(--bg-muted)',
          }}
        >
          <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={add}
            disabled={!form.name || !form.email || !form.password}
          >
            <Icon name="check" size={14} /> Add member
          </button>
        </div>
      </Modal>
    </div>
  );
}
