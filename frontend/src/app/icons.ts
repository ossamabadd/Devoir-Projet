import { Component, input } from '@angular/core';

@Component({
  selector: 'bank-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @switch (name()) {
      @case ('wallet') {
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18M16 15h2" />
      }
      @case ('users') {
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" />
      }
      @case ('spark') {
        <path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2ZM20 2v4m-2-2h4" />
      }
      @case ('search') {
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      }
      @case ('plus') {
        <path d="M12 5v14M5 12h14" />
      }
      @case ('right') {
        <path d="m9 6 6 6-6 6" />
      }
      @case ('back') {
        <path d="m12 5-7 7 7 7M5 12h15" />
      }
      @case ('send') {
        <path d="m3 10 18-7-6 18-3.5-8.5ZM11.5 12.5 21 3" />
      }
      @case ('bank') {
        <path d="m3 9 9-6 9 6ZM5 20h14M7 11v6m5-6v6m5-6v6" />
      }
      @case ('close') {
        <path d="m6 6 12 12M18 6 6 18" />
      }
      @case ('check') {
        <path d="m5 12 4 4L19 6" />
      }
      @case ('copy') {
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 5V4H6a2 2 0 0 0-2 2v10h1" />
      }
    }
  </svg>`,
  styles: [
    ':host{display:inline-flex;width:1.2em;height:1.2em;flex:none}svg{width:100%;height:100%}',
  ],
})
export class Icon {
  name = input.required<string>();
}
