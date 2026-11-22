import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import {
  provideRouter,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  withHashLocation,
  withInMemoryScrolling,
} from '@angular/router';
import { Accounts, Customers, NewAccount, Detail } from './app/accounts';
import { Assistant } from './app/assistant';
import { Icon } from './app/icons';

@Component({
  selector: 'bank-app',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <aside class="sidebar">
      <a routerLink="/accounts" class="brand" aria-label="Accueil Ebank">
        <span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Ebank<span class="brand-dot">.</span></span>
      </a>
      <nav aria-label="Navigation principale">
        <a routerLink="/accounts" routerLinkActive="active" ariaCurrentWhenActive="page">
          <bank-icon name="wallet" /> Comptes
        </a>
        <a routerLink="/customers" routerLinkActive="active" ariaCurrentWhenActive="page">
          <bank-icon name="users" /> Clients
        </a>
        <a routerLink="/chat" routerLinkActive="active" ariaCurrentWhenActive="page">
          <bank-icon name="spark" /> Assistant
        </a>
      </nav>
      <div class="workspace">
        <span class="workspace-icon"><bank-icon name="bank" /></span>
        <span>Espace démo<small>Données fictives</small></span>
      </div>
    </aside>
    <main>
      <router-outlet />
    </main>
  `,
})
class App {}

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter(
      [
        { path: 'accounts/new', component: NewAccount, title: 'Ouvrir un compte · Ebank' },
        { path: 'accounts/:id', component: Detail, title: 'Détail du compte · Ebank' },
        { path: 'accounts', component: Accounts, title: 'Comptes · Ebank' },
        { path: 'customers', component: Customers, title: 'Clients · Ebank' },
        { path: 'chat', component: Assistant, title: 'Assistant · Ebank' },
        { path: '**', redirectTo: 'accounts' },
      ],
      withHashLocation(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
  ],
}).catch(console.error);
