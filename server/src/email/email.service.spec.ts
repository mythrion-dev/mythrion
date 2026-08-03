import { Test } from '@nestjs/testing';
import { EmailService } from './email.service';

const mockFetch = jest.fn();
const mockJson = jest.fn();

type MockedInit = RequestInit & { body?: string };

function fetchCall(): [string, MockedInit] {
  return mockFetch.mock.calls[0] as [string, MockedInit];
}

const ENV_VARS = [
  'HOSTINGER_MAIL_API_TOKEN',
  'HOSTINGER_MAILBOX_ID',
  'EMAIL_FROM',
];

function mockResponse({
  ok = true,
  status = 204,
  jsonValue,
}: {
  ok?: boolean;
  status?: number;
  jsonValue?: unknown;
}) {
  mockJson.mockResolvedValue(jsonValue);
  return { ok, status, json: mockJson } as unknown as Response;
}

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [EmailService],
  }).compile();
  return module.get<EmailService>(EmailService);
}

describe('EmailService', () => {
  let service: EmailService;
  const savedEnv: Record<string, string | undefined> = {};

  const baseParams = {
    to: 'player@test.com',
    campaignName: 'Test Campaign',
    inviterName: 'Mighty GM',
    role: 'PLAYER',
    inviteUrl: 'http://localhost:3001/invite/abc',
    expiresAt: new Date('2025-06-15'),
  };

  beforeAll(() => {
    global.fetch = mockFetch;
    for (const v of ENV_VARS) savedEnv[v] = process.env[v];
  });

  afterAll(() => {
    for (const v of ENV_VARS) {
      if (savedEnv[v] === undefined) delete process.env[v];
      else process.env[v] = savedEnv[v];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const v of ENV_VARS) delete process.env[v];
    mockFetch.mockResolvedValue(mockResponse({}));
  });

  describe('when HOSTINGER_MAIL_API_TOKEN / HOSTINGER_MAILBOX_ID are not set', () => {
    it('sends nothing and logs [DEV] message (does not throw)', async () => {
      service = await buildService();

      await expect(service.sendInvitation(baseParams)).resolves.toBeUndefined();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('when Hostinger env vars are set', () => {
    beforeEach(() => {
      process.env.HOSTINGER_MAIL_API_TOKEN = 'secret-token';
      process.env.HOSTINGER_MAILBOX_ID = 'AC1a2b3c4d5e6f7g';
    });

    it('POSTs the send payload to the right mailbox endpoint with bearer auth', async () => {
      service = await buildService();
      await service.sendInvitation(baseParams);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetchCall();
      expect(url).toBe(
        'https://api.mail.hostinger.com/api/v1/mailboxes/AC1a2b3c4d5e6f7g/send',
      );
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: 'Bearer secret-token',
        'Content-Type': 'application/json',
      });
      expect(init.signal).toBeDefined();
    });

    it('sends default display name and subject when EMAIL_FROM is unset', async () => {
      service = await buildService();
      await service.sendInvitation(baseParams);

      const [, init] = fetchCall();
      const body = JSON.parse(init.body!) as {
        to: string[];
        displayName: string;
        subject: string;
      };
      expect(body).toEqual(
        expect.objectContaining({
          to: ['player@test.com'],
          displayName: 'Mythrion',
          subject: 'Mighty GM invited you to Test Campaign',
        }),
      );
    });

    it('derives the display name from EMAIL_FROM', async () => {
      process.env.EMAIL_FROM = 'No-Reply <no-reply@mythrion.com.br>';

      service = await buildService();
      await service.sendInvitation(baseParams);

      const [, init] = fetchCall();
      const body = JSON.parse(init.body!) as { displayName: string };
      expect(body.displayName).toBe('No-Reply');
    });

    it('builds HTML and text templates with invitation details', async () => {
      service = await buildService();
      await service.sendInvitation({
        ...baseParams,
        campaignName: 'My Campaign',
        inviterName: 'Alice',
        role: 'GM',
        inviteUrl: 'https://mythrion.com/invite/token123',
        expiresAt: new Date('2025-07-01T12:00:00Z'),
      });

      const [, init] = fetchCall();
      const body = JSON.parse(init.body!) as { html: string; text: string };
      expect(body.html).toContain('Alice invited you');
      expect(body.html).toContain('My Campaign');
      expect(body.html).toContain('GM');
      expect(body.html).toContain('https://mythrion.com/invite/token123');
      expect(body.html).toContain('July');
      expect(body.text).toContain('My Campaign');
      expect(body.text).toContain(
        'Accept the invitation: https://mythrion.com/invite/token123',
      );
    });

    it('resolves on a 204 success', async () => {
      mockFetch.mockResolvedValue(mockResponse({}));

      service = await buildService();

      await expect(service.sendInvitation(baseParams)).resolves.toBeUndefined();
    });

    it('throws with the API error code on a non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          ok: false,
          status: 422,
          jsonValue: {
            error: 'Something is invalid.',
            code: 'ERR_INVALID_REQUEST',
          },
        }),
      );

      service = await buildService();

      await expect(service.sendInvitation(baseParams)).rejects.toThrow(
        'ERR_INVALID_REQUEST',
      );
    });

    it('throws with the HTTP status when the error body is not JSON', async () => {
      mockJson.mockRejectedValue(new SyntaxError('Unexpected token'));
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: mockJson,
      });

      service = await buildService();

      await expect(service.sendInvitation(baseParams)).rejects.toThrow(
        'Hostinger Mail API error (HTTP 403)',
      );
    });

    it('rejects when the API call fails', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));

      service = await buildService();

      await expect(service.sendInvitation(baseParams)).rejects.toThrow(
        'network down',
      );
    });
  });
});
