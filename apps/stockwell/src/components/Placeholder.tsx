'use client';
import { EmptyState } from './ui';

export default function Placeholder({
  title,
  sub,
  icon,
  body,
}: {
  title: string;
  sub: string;
  icon: string;
  body?: string;
}) {
  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">{title}</div>
          <div className="ph-sub">{sub}</div>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon={icon}
          title={`${title} — coming soon`}
          body={
            body ||
            'This module is part of the design and scaffolded in the app. The core inventory, products, orders, suppliers, warehouses and customers modules are fully wired to the database.'
          }
        />
      </div>
    </div>
  );
}
