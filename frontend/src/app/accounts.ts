import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Account,
  AccountDetails,
  AccountType,
  Bank,
  amount,
  apiError,
  date,
  initials,
  searchKey,
  typeName,
} from './bank';
import { Icon } from './icons';

@Component({
  selector: 'bank-status',
  template: `@if (bank.loading()) {
      <p class="notice loading" role="status"><i class="spinner" aria-hidden="true"></i>Chargement des données…</p>
    } @else if (bank.error()) {
      <div class="notice error" role="alert">
        <span>{{ bank.error() }}</span><button class="secondary" (click)="bank.refresh()">Réessayer</button>
      </div>
    }`,
})
export class BankStatus {
  readonly bank = inject(Bank);
}

@Component({
  imports: [RouterLink, FormsModule, Icon, BankStatus],
  templateUrl: './accounts.html',
})
export class Accounts {
  readonly bank = inject(Bank);
  readonly query = this.bank.accountQuery;
  readonly type = this.bank.accountType;
  readonly filtered = computed(() => {
    const query = searchKey(this.query());
    const type = this.type();
    return this.bank
      .accounts()
      .filter(
        (a) =>
          (!type || a.type === type) &&
          [a.id, this.owner(a), typeName(a.type)].some((value) => searchKey(value).includes(query)),
      );
  });
  readonly total = computed(() => this.bank.accounts().reduce((sum, a) => sum + a.balance, 0));
  readonly current = computed(() =>
    this.bank
      .accounts()
      .filter((a) => a.type === 'CURRENT')
      .reduce((sum, a) => sum + a.balance, 0),
  );
  readonly savings = computed(() => this.total() - this.current());
  readonly share = computed(() => (this.total() ? Math.round((this.current() / this.total()) * 100) : 0));
  readonly amount = amount;
  readonly date = date;
  readonly typeName = typeName;
  readonly initials = initials;
  owner(a: Account) {
    return this.bank.owners().get(a.customerId)?.name ?? 'Client ' + a.customerId;
  }
  clearFilters() {
    this.query.set('');
    this.type.set('');
  }
}

@Component({
  imports: [BankStatus, Icon, FormsModule],
  template: `<section class="page">
    <div class="heading"><h1>Clients</h1></div>
    <bank-status />
    @if (!bank.loading() && !bank.error()) {
      <div class="panel directory">
        <div class="panel-head">
          <h2>
            Répertoire <span class="count" aria-live="polite">{{ filtered().length }}</span>
          </h2>
          <div class="search">
            <bank-icon name="search" />
            <input
              #customerSearch
              type="search"
              aria-label="Rechercher un client"
              placeholder="Nom ou e-mail"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
            @if (query()) {
              <button type="button" class="icon-button" aria-label="Effacer la recherche"
                title="Effacer la recherche" (click)="query.set(''); customerSearch.focus()">
                <bank-icon name="close" />
              </button>
            }
          </div>
        </div>
        <div class="table-wrap">
          <table class="customers-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Adresse e-mail</th>
                <th class="numeric">Comptes</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filtered(); track c.id) {
                <tr>
                  <td>
                    <div class="person">
                      <span class="avatar" [attr.data-tone]="c.id % 4" aria-hidden="true">{{ initials(c.name) }}</span>
                      <span>{{ c.name }}<small class="mobile-email">{{ c.email }}</small></span>
                    </div>
                  </td>
                  <td class="customer-email">{{ c.email }}</td>
                  <td class="numeric">{{ counts().get(c.id) ?? 0 }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="empty">
                    <strong>Aucun client trouvé</strong>
                    @if (query()) {
                      <button type="button" class="secondary" (click)="query.set(''); customerSearch.focus()">
                        Effacer la recherche
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  </section>`,
})
export class Customers {
  readonly bank = inject(Bank);
  readonly initials = initials;
  readonly query = signal('');
  readonly filtered = computed(() => {
    const query = searchKey(this.query());
    return this.bank.customers().filter((c) => searchKey(c.name + ' ' + c.email).includes(query));
  });
  readonly counts = computed(() => {
    const counts = new Map<number, number>();
    for (const a of this.bank.accounts())
      counts.set(a.customerId, (counts.get(a.customerId) ?? 0) + 1);
    return counts;
  });
}

@Component({
  imports: [FormsModule, RouterLink, Icon, BankStatus],
  template: `<section class="page narrow">
    <a routerLink="/accounts" class="back"><bank-icon name="back" /> Comptes</a>
    <div class="heading"><h1>Ouvrir un compte</h1></div>
    <bank-status />
    @if (!bank.loading() && !bank.error()) {
      <form class="form panel" #form="ngForm" (ngSubmit)="submit()" [attr.aria-busy]="sending()">
        <fieldset [disabled]="sending()">
          <label for="customer">Titulaire</label>
          <select id="customer" required name="customer" [(ngModel)]="customerId">
            <option [ngValue]="null" disabled>Sélectionner un client</option>
            @for (c of bank.customers(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
          <div class="form-row">
            <div>
              <label for="account-type">Type de compte</label>
              <select id="account-type" required name="type" [(ngModel)]="type">
                <option value="CURRENT">Courant</option>
                <option value="SAVINGS">Épargne</option>
              </select>
            </div>
            <div>
              <label for="balance">Solde initial</label>
              <div class="currency-field">
                <input id="balance" required name="balance" type="number" inputmode="decimal"
                  min="0" max="999999999999.99" step="0.01" [(ngModel)]="balance" placeholder="0,00"
                  [attr.aria-invalid]="balance !== null && !validBalance() ? 'true' : null"
                  aria-describedby="balance-hint" />
                <span>MAD</span>
              </div>
              <small id="balance-hint" [class.field-error]="balance !== null && !validBalance()">
                Montant positif ou nul, avec deux décimales au maximum.
              </small>
            </div>
          </div>
        </fieldset>
        @if (error()) {
          <p class="notice error" role="alert">{{ error() }}</p>
        }
        <div class="actions">
          @if (!sending()) {
            <a class="secondary" routerLink="/accounts">Annuler</a>
          }
          <button class="primary" [disabled]="form.invalid || !validBalance() || sending()">
            @if (sending()) { <i class="spinner" aria-hidden="true"></i> }
            {{ sending() ? 'Ouverture…' : 'Ouvrir le compte' }}
          </button>
        </div>
      </form>
    }
  </section>`,
})
export class NewAccount {
  readonly bank = inject(Bank);
  private readonly router = inject(Router);
  customerId: number | null = null;
  type: AccountType = 'CURRENT';
  balance: number | null = null;
  readonly sending = signal(false);
  readonly error = signal('');
  validBalance() {
    return this.balance !== null && this.balance <= 999999999999.99 && /^\d+(\.\d{1,2})?$/.test(String(this.balance));
  }
  submit() {
    if (this.sending() || this.customerId === null || !this.validBalance()) return;
    this.sending.set(true);
    this.error.set('');
    this.bank.http
      .post<Account>('/api/accounts', {
        customerId: this.customerId,
        type: this.type,
        balance: this.balance,
      })
      .subscribe({
        next: (a) => {
          this.bank.refresh();
          void this.router.navigate(['/accounts', a.id], { info: 'account-created' });
        },
        error: (e) => {
          this.error.set(apiError(e));
          this.sending.set(false);
        },
      });
  }
}

@Component({
  imports: [RouterLink, Icon],
  template: `<section class="page narrow">
    <a routerLink="/accounts" class="back"><bank-icon name="back" /> Comptes</a>
    <div class="heading"><h1>Détail du compte</h1></div>
    @if (details(); as d) {
      @if (created) {
        <p class="notice success" role="status"><bank-icon name="check" /> Le compte a été ouvert.</p>
      }
      <div class="panel detail">
        <div class="detail-top">
          <span>Solde disponible</span>
          <h2>{{ amount(d.account.balance) }} <small>MAD</small></h2>
        </div>
        <dl>
          <dt>Titulaire</dt>
          <dd>{{ d.customer.name }}</dd>
          <dt>Adresse e-mail</dt>
          <dd>{{ d.customer.email }}</dd>
          <dt>Type</dt>
          <dd><span class="pill" [class.savings]="d.account.type === 'SAVINGS'">{{ typeName(d.account.type) }}</span></dd>
          <dt>Ouverture</dt>
          <dd>{{ date(d.account.createdAt) }}</dd>
          <dt>Identifiant</dt>
          <dd class="account-identifier">
            <span class="mono">{{ d.account.id }}</span>
            <button type="button" class="icon-button" aria-label="Copier l’identifiant" title="Copier l’identifiant"
              (click)="copyId(d.account.id)"><bank-icon name="copy" /></button>
            <small aria-live="polite">{{ copyStatus() }}</small>
          </dd>
        </dl>
      </div>
    } @else if (error()) {
      <div class="notice error" role="alert">
        <span>{{ error() }}</span><button class="secondary" (click)="load()">Réessayer</button>
      </div>
    } @else {
      <p class="notice loading" role="status"><i class="spinner" aria-hidden="true"></i>Chargement du compte…</p>
    }
  </section>`,
})
export class Detail {
  private readonly bank = inject(Bank);
  private readonly route = inject(ActivatedRoute);
  readonly created = inject(Router).currentNavigation()?.extras.info === 'account-created';
  readonly details = signal<AccountDetails | null>(null);
  readonly error = signal('');
  readonly copyStatus = signal('');
  readonly amount = amount;
  readonly typeName = typeName;
  readonly date = date;
  constructor() {
    this.load();
  }
  async copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      this.copyStatus.set('Identifiant copié.');
    } catch {
      this.copyStatus.set('Impossible de copier automatiquement.');
    }
  }
  load() {
    this.error.set('');
    const id = encodeURIComponent(this.route.snapshot.paramMap.get('id') ?? '');
    this.bank.http
      .get<AccountDetails>('/api/accounts/' + id)
      .subscribe({ next: (d) => this.details.set(d), error: (e) => this.error.set(apiError(e)) });
  }
}
