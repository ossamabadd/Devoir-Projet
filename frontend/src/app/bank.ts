import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

export interface Customer {
  id: number;
  name: string;
  email: string;
}
export type AccountType = 'CURRENT' | 'SAVINGS';
export interface Account {
  id: string;
  customerId: number;
  balance: number;
  type: AccountType;
  createdAt: string;
}
export interface AccountDetails {
  account: Account;
  customer: Customer;
}

export const typeName = (type: AccountType) => (type === 'CURRENT' ? 'Courant' : 'Épargne');
const numberFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
export const amount = (n: number) => numberFormat.format(n);
export const searchKey = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export const date = (s: string) => dateFormat.format(new Date(s + 'T12:00:00'));
export const initials = (s: string) => {
  const parts = s.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : s.slice(0, 2);
};
export function apiError(error: HttpErrorResponse) {
  if (error.status === 404) return 'Enregistrement introuvable.';
  if (error.status === 400) return 'Vérifiez les informations saisies.';
  return 'Le service est indisponible. Réessayez dans un instant.';
}

@Injectable({ providedIn: 'root' })
export class Bank {
  readonly http = inject(HttpClient);
  readonly accountQuery = signal('');
  readonly accountType = signal('');
  readonly accounts = signal<Account[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly owners = computed(() => new Map(this.customers().map((c) => [c.id, c])));
  readonly loading = signal(true);
  readonly error = signal('');
  constructor() {
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      accounts: this.http.get<Account[]>('/api/accounts'),
      customers: this.http.get<Customer[]>('/api/customers'),
    }).subscribe({
      next: (data) => {
        this.accounts.set(data.accounts);
        this.customers.set(data.customers);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.loading.set(false);
      },
    });
  }
}
