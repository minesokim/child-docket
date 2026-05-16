// Unit tests for the workers-side 8879 notification helper.
//
// Covers buildMessageBody — the pure-function piece — in two modes:
//   - Initial send (isReminder=false): English "Hi" + Spanish "Hola"
//   - Reminder send (isReminder=true): English "quick reminder" +
//     Spanish "recordatorio rápido" openers
// Twilio + DB are tested by the production smoke (Antonio's
// envelope create + the cron's actions-row writes).

import { describe, expect, test } from 'bun:test';
import { buildMessageBody } from './sign-8879-notification';

describe('buildMessageBody — workers helper', () => {
  test('initial English send', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://docket-portal.vercel.app/portal/sign-8879/abc-123',
      taxYear: 2024,
      preferredLanguage: 'en',
    });
    expect(body).toContain('Hi Maria');
    expect(body).toContain('— Antonio');
    expect(body).toContain('2024 Form 8879');
    expect(body).toContain('https://docket-portal.vercel.app/portal/sign-8879/abc-123');
    expect(body).not.toContain('reminder');
    expect(body).not.toContain('Hola');
  });

  test('reminder English send', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'en',
      isReminder: true,
    });
    expect(body).toContain('Hi Maria');
    expect(body).toContain('quick reminder');
    expect(body).toContain('still waiting on your signature');
    expect(body).not.toContain('Hola');
  });

  test('initial Spanish send', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'es',
    });
    expect(body).toContain('Hola Maria');
    expect(body).toContain('Formulario 8879');
    expect(body).toContain('Firma aquí');
    expect(body).not.toContain('recordatorio');
  });

  test('reminder Spanish send', () => {
    const body = buildMessageBody({
      clientFirstName: 'Maria',
      senderFirstName: 'Antonio',
      signingUrl: 'https://example.com/sign',
      taxYear: 2024,
      preferredLanguage: 'es',
      isReminder: true,
    });
    expect(body).toContain('Hola Maria');
    expect(body).toContain('recordatorio rápido');
    expect(body).toContain('aún espera tu firma');
  });

  test('reminder body stays under SMS-segment cost ceiling', () => {
    // Spanish reminder is longer than English (Spanish is verbose);
    // both must stay under 1600 chars to keep Twilio segment count
    // ≤ 10. If a future copy edit pushes past this, send cost
    // balloons.
    const longClient = 'Maria-Carmen-Esperanza';
    const enReminder = buildMessageBody({
      clientFirstName: longClient,
      senderFirstName: 'Antonio',
      signingUrl:
        'https://docket-portal.vercel.app/portal/sign-8879/01234567-89ab-cdef-0123-456789abcdef',
      taxYear: 2025,
      preferredLanguage: 'en',
      isReminder: true,
    });
    const esReminder = buildMessageBody({
      clientFirstName: longClient,
      senderFirstName: 'Antonio',
      signingUrl:
        'https://docket-portal.vercel.app/portal/sign-8879/01234567-89ab-cdef-0123-456789abcdef',
      taxYear: 2025,
      preferredLanguage: 'es',
      isReminder: true,
    });
    expect(enReminder.length).toBeLessThan(1600);
    expect(esReminder.length).toBeLessThan(1600);
  });
});
