import { HttpClient } from '@angular/common/http';
import { afterRenderEffect, Component, computed, ElementRef, inject, Injectable, input, signal, viewChild } from '@angular/core';
import { Icon } from './icons';

interface Turn {
  sender: 'Vous' | 'Assistant';
  text: string;
}
type Block =
  { kind: 'text'; text: string } | { kind: 'table'; headers: string[]; rows: string[][] };

const inlineParts = (text: string) => text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);

@Component({
  selector: 'bank-inline-text',
  template: `@for (part of parts(); track $index) {
    @if ($index % 2 === 0) {
      {{ part }}
    } @else if (part.startsWith('**')) {
      <b>{{ part.slice(2, -2) }}</b>
    } @else {
      <code>{{ part.slice(1, -1) }}</code>
    }
  }`,
})
export class InlineText {
  readonly text = input.required<string>();
  readonly parts = computed(() => inlineParts(this.text()));
}

@Component({
  selector: 'bank-answer',
  imports: [InlineText],
  template: `@for (block of blocks(); track $index) {
    @if (block.kind === 'text') {
      <p class="message-text"><bank-inline-text [text]="block.text" /></p>
    } @else {
      <div class="table-wrap">
        <table class="answer-table">
          <thead>
            <tr>
              @for (h of block.headers; track $index) {
                <th scope="col"><bank-inline-text [text]="h" /></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of block.rows; track $index) {
              <tr>
                @for (cell of row; track $index) {
                  <td><bank-inline-text [text]="cell" /></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  }`,
})
export class Answer {
  readonly text = input.required<string>();
  readonly blocks = computed(() => {
    const blocks: Block[] = [];
    const lines = this.text().split(/\r?\n/);
    const cells = (line: string) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim());
    let paragraph: string[] = [];
    function flush() {
      const text = paragraph.join('\n').trim();
      if (text) blocks.push({ kind: 'text', text });
      paragraph = [];
    }
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes('|') &&
        lines[i + 1]?.includes('|') &&
        cells(lines[i + 1]).length === cells(lines[i]).length &&
        cells(lines[i + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
      ) {
        flush();
        const headers = cells(lines[i]);
        const rows: string[][] = [];
        i++;
        while (lines[i + 1]?.includes('|') && cells(lines[i + 1]).length === headers.length) {
          rows.push(cells(lines[++i]));
        }
        blocks.push({ kind: 'table', headers, rows });
      } else {
        paragraph.push(lines[i]);
      }
    }
    flush();
    return blocks;
  });
}

@Injectable({ providedIn: 'root' })
class Conversation {
  private readonly http = inject(HttpClient);
  private id = crypto.randomUUID();
  readonly turns = signal<Turn[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  draft = '';

  ask(question: string) {
    const message = question.trim();
    if (!message || this.busy()) return;
    this.turns.update((turns) => [...turns, { sender: 'Vous', text: message }]);
    this.request(message);
  }

  retry() {
    const last = this.turns().at(-1);
    if (this.error() && !this.busy() && last?.sender === 'Vous') this.request(last.text);
  }

  private request(message: string) {
    this.busy.set(true);
    this.error.set('');
    this.http
      .post<{ answer: string }>('/api/chat', { conversationId: this.id, message })
      .subscribe({
        next: (data) => {
          this.turns.update((turns) => [...turns, { sender: 'Assistant', text: data.answer }]);
          this.busy.set(false);
        },
        error: () => {
          this.error.set('Impossible d’obtenir une réponse. Réessayez dans un instant.');
          this.busy.set(false);
        },
      });
  }
  reset() {
    if (this.busy()) return;
    this.id = crypto.randomUUID();
    this.draft = '';
    this.turns.set([]);
    this.error.set('');
  }
}

@Component({
  imports: [Icon, Answer],
  template: `<section class="page chat-page">
    <div class="heading">
      <h1>Assistant bancaire</h1>
      @if (chat.turns().length) {
        <button class="secondary" [disabled]="chat.busy()" (click)="chat.reset(); question.focus()">
          <bank-icon name="plus" />
          Nouvelle conversation
        </button>
      }
    </div>
    <div class="panel chat">
      <div #thread class="thread" (scroll)="onScroll(thread)"
        [attr.tabindex]="chat.turns().length ? '0' : null" role="region" aria-label="Conversation">
        @if (!chat.turns().length) {
          <div class="chat-empty">
            <span class="assistant-icon"><bank-icon name="spark" /></span>
            <h2>Que souhaitez-vous consulter ?</h2>
            <p>Retrouvez un titulaire, un compte ou son solde.</p>
            <div class="suggestions">
              @for (q of suggestions; track q) {
                <button class="secondary" type="button" (click)="send(q)">
                  {{ q }} <bank-icon name="right" />
                </button>
              }
            </div>
          </div>
        }
        <div class="turns" role="log" aria-label="Messages">
          @for (turn of chat.turns(); track $index) {
            <article [class.user]="turn.sender === 'Vous'">
              <strong class="sender">{{ turn.sender }}</strong>
              @if (turn.sender === 'Assistant') {
                <bank-answer [text]="turn.text" />
              } @else {
                <p class="message-text">{{ turn.text }}</p>
              }
            </article>
          }
        </div>
        @if (chat.busy()) {
          <p role="status" class="typing"><i class="spinner" aria-hidden="true"></i>L’assistant consulte les comptes…</p>
        }
        @if (chat.error()) {
          <div class="notice error chat-error">
            <span role="alert">{{ chat.error() }}</span>
            <button class="secondary" type="button" (click)="retry(); question.focus()">Réessayer</button>
          </div>
        }
      </div>
      <form class="composer" (submit)="$event.preventDefault(); send(chat.draft); question.focus()">
        <textarea
          #question
          rows="1"
          name="question"
          maxlength="4000"
          [value]="chat.draft"
          (input)="chat.draft = question.value"
          (keydown)="onKeydown($event)"
          placeholder="Posez votre question…"
          aria-label="Votre question"
        ></textarea>
        <button
          class="primary"
          type="submit"
          [disabled]="!chat.draft.trim() || chat.busy()"
          aria-label="Envoyer"
        >
          @if (chat.busy()) { <i class="spinner" aria-hidden="true"></i> }
          @else { <bank-icon name="send" /> }
        </button>
      </form>
    </div>
  </section>`,
})
export class Assistant {
  readonly chat = inject(Conversation);
  readonly suggestions = [
    'Lister les comptes dans un tableau',
    'Consulter les comptes de Salma Idrissi',
  ];
  private readonly thread = viewChild.required<ElementRef<HTMLDivElement>>('thread');
  private stickToEnd = true;

  constructor() {
    afterRenderEffect(() => {
      this.chat.turns();
      this.chat.busy();
      this.chat.error();
      const thread = this.thread().nativeElement;
      if (this.stickToEnd) thread.scrollTop = thread.scrollHeight;
    });
  }

  onScroll(thread: HTMLDivElement) {
    this.stickToEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.send(this.chat.draft);
  }

  send(message: string) {
    if (!message.trim() || this.chat.busy()) return;
    this.stickToEnd = true;
    this.chat.ask(message);
    if (message === this.chat.draft) this.chat.draft = '';
  }

  retry() {
    this.stickToEnd = true;
    this.chat.retry();
  }
}
