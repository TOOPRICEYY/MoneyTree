import { useState } from 'react';

import type { Purchase } from '@moneytree/core';

import { formatDate } from '../format.ts';

import { Money } from './Money.tsx';

type PurchaseRowProps = {
  purchase: Purchase;
};

export function PurchaseRow({ purchase }: PurchaseRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = `purchase-${purchase.source}-${purchase.externalId}`;

  return (
    <>
      <tr>
        <td>{formatDate(purchase.date)}</td>
        <td>{purchase.merchant}</td>
        <td className="num hide-narrow">{purchase.items.length}</td>
        <td className="num">
          <Money cents={purchase.total} />
        </td>
        <td className="num">
          <button
            type="button"
            className="link-button"
            aria-expanded={isOpen}
            aria-controls={detailsId}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? 'Hide' : 'Items'}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr id={detailsId} className="details-row">
          <td colSpan={5}>
            <ul className="line-items">
              {purchase.items.map((item, index) => (
                <li key={`${item.sku ?? item.description}-${index}`}>
                  <span>
                    {item.description}
                    {item.quantity && item.quantity > 1
                      ? ` ×${item.quantity}`
                      : ''}
                  </span>
                  <Money cents={item.amount} />
                </li>
              ))}
              {purchase.adjustments.map((adjustment, index) => (
                <li key={`adj-${index}`} className="adjustment">
                  <span>{adjustment.kind}</span>
                  <Money cents={adjustment.amount} />
                </li>
              ))}
              {purchase.items.length === 0 && (
                <li className="muted">No line items on this receipt.</li>
              )}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
