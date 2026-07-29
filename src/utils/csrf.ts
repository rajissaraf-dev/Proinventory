// utils/csrf.ts
export const CSRFToken = {
  generate(): string {
    return crypto.randomUUID();
  },

  store(token: string): void {
    sessionStorage.setItem('csrf_token', token);
  },

  get(): string | null {
    return sessionStorage.getItem('csrf_token');
  },

  validate(token: string): boolean {
    const stored = this.get();
    return stored === token;
  },

  // Use in forms
  addToForm(form: HTMLFormElement): void {
    const token = this.generate();
    this.store(token);
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = token;
    form.appendChild(input);
  }
};